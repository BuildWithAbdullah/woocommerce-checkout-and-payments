<?php
/**
 * The order received page, and the account somebody made on the way to it.
 */

add_action( 'woocommerce_thankyou', 'acme_notify_warehouse_before' );

function acme_notify_warehouse_before( $order_id ) {
	$order = wc_get_order( $order_id );

	wp_remote_post(
		'https://warehouse.example.test/orders',
		array(
			'timeout' => 10,
			'body'    => wp_json_encode( array( 'order' => $order_id ) ),
		)
	);

	$order->add_order_note( 'Sent to the warehouse.' );
}

function acme_render_order_summary_before() {
	$order_id = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
	$order    = wc_get_order( $order_id );

	if ( ! $order ) {
		return;
	}

	echo esc_html( $order->get_formatted_billing_full_name() );
}

function acme_create_account_at_checkout_before( $data ) {
	$customer_id = wc_create_new_customer( $data['billing_email'], $data['account_username'] );

	return $customer_id;
}
