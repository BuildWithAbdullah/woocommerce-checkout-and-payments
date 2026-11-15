<?php
/**
 * The same three jobs, with the warehouse told once however many times the
 * page is loaded, the order key checked before anything is rendered, and the
 * new account attached to the order that created it.
 */

add_action( 'woocommerce_thankyou', 'acme_notify_warehouse_after' );

function acme_notify_warehouse_after( $order_id ) {
	$order = wc_get_order( $order_id );

	if ( ! $order || $order->get_meta( '_acme_warehouse_notified' ) ) {
		return;
	}

	$response = wp_remote_post(
		'https://warehouse.example.test/orders',
		array(
			'timeout' => 10,
			'body'    => wp_json_encode( array( 'order' => $order_id ) ),
		)
	);

	if ( is_wp_error( $response ) ) {
		return;
	}

	$order->update_meta_data( '_acme_warehouse_notified', time() );
	$order->add_order_note( 'Sent to the warehouse.' );
	$order->save();
}

function acme_render_order_summary_after() {
	$order_id = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
	$given    = isset( $_GET['key'] ) ? sanitize_text_field( wp_unslash( $_GET['key'] ) ) : '';
	$order    = wc_get_order( $order_id );

	if ( ! $order || '' === $given ) {
		return;
	}

	if ( ! hash_equals( $order->get_order_key(), $given ) ) {
		return;
	}

	echo esc_html( $order->get_formatted_billing_full_name() );
}

function acme_create_account_at_checkout_after( $data, $order ) {
	$customer_id = wc_create_new_customer( $data['billing_email'], $data['account_username'] );

	if ( is_wp_error( $customer_id ) ) {
		return $customer_id;
	}

	$order->set_customer_id( $customer_id );
	$order->save();

	return $customer_id;
}
