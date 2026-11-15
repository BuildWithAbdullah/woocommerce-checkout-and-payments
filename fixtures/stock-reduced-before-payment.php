<?php
/**
 * Inventory comes down when the order is created, so an abandoned checkout
 * holds stock nobody has paid for.
 */

add_action( 'woocommerce_checkout_order_processed', 'acme_reduce_stock_on_create', 10, 3 );

function acme_reduce_stock_on_create( $order_id, $posted_data, $order ) {
	wc_reduce_stock_levels( $order_id );

	$order->add_order_note( 'Stock reduced at order creation.' );
}
