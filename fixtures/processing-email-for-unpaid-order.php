<?php
/**
 * The order is moved to processing, and its email sent, before anybody has
 * established that the money arrived.
 */

add_action( 'woocommerce_checkout_order_processed', 'acme_mark_processing', 10, 3 );

function acme_mark_processing( $order_id, $posted_data, $order ) {
	if ( ! $order->has_status( 'pending' ) ) {
		return;
	}

	$order->update_status( 'processing', 'Thanks, your order is on its way.' );
}
