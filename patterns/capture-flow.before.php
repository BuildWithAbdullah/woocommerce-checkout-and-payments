<?php
/**
 * Authorising, capturing, redirecting and refunding.
 */

add_action( 'wp_ajax_acme_capture_order', 'acme_capture_order_before' );

function acme_capture_order_before() {
	$order  = wc_get_order( absint( $_POST['order_id'] ) );
	$client = new Acme_Gateway_Client_Before( 'secret' );

	$auth = $client->authorize(
		$order->get_total(),
		array( 'capture' => false )
	);

	$order->payment_complete( $auth['reference'] );

	wp_send_json_success();
}

function acme_start_redirect_flow_before( $order ) {
	$url = 'https://pay.example-gateway.test/start?merchant=acme';

	wp_redirect( $url );
	exit;
}

function acme_refund_before( $order, $amount ) {
	$client = new Acme_Gateway_Client_Before( 'secret' );

	$client->refund( $order->get_transaction_id(), $amount );

	$order->add_order_note( 'Refunded ' . $amount . ' at the gateway.' );
}
