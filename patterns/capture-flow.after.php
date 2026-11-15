<?php
/**
 * The same four operations: the endpoint asks who is calling, the paid status
 * waits for the capture, the redirect carries a reference back, and the refund
 * is recorded in WooCommerce as well as at the gateway.
 */

add_action( 'wp_ajax_acme_capture_order', 'acme_capture_order_after' );

function acme_capture_order_after() {
	check_ajax_referer( 'acme_capture_order' );

	if ( ! current_user_can( 'edit_shop_orders' ) ) {
		wp_send_json_error( array( 'message' => 'Not allowed.' ), 403 );
	}

	$order = wc_get_order( absint( $_POST['order_id'] ) );

	if ( ! $order || ! $order->has_status( array( 'pending', 'on-hold' ) ) ) {
		wp_send_json_error( array( 'message' => 'That order is not waiting to be captured.' ), 409 );
	}

	$client = new Acme_Gateway_Client_After( 'secret' );

	$auth = $client->authorize(
		$order->get_total(),
		array( 'capture' => false )
	);

	$order->update_meta_data( '_acme_authorisation', $auth['reference'] );
	$order->update_status( 'on-hold', 'Authorised. Waiting for the capture to confirm.' );
	$order->save();

	$capture = $client->capture( $auth['reference'] );

	if ( empty( $capture['captured'] ) ) {
		wp_send_json_error( array( 'message' => 'The capture did not confirm.' ), 502 );
	}

	$order->payment_complete( $capture['reference'] );

	wp_send_json_success();
}

function acme_start_redirect_flow_after( $order ) {
	$order->update_meta_data( '_acme_redirect_started', time() );
	$order->save();

	$url = add_query_arg(
		array(
			'merchant' => 'acme',
			'return'   => rawurlencode( $order->get_checkout_order_received_url() ),
			'order_id' => $order->get_id(),
		),
		'https://pay.example-gateway.test/start'
	);

	wp_redirect( $url );
	exit;
}

function acme_refund_after( $order, $amount, $reason = '' ) {
	$client = new Acme_Gateway_Client_After( 'secret' );
	$result = $client->refund( $order->get_transaction_id(), $amount );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return wc_create_refund(
		array(
			'order_id' => $order->get_id(),
			'amount'   => $amount,
			'reason'   => $reason,
		)
	);
}
