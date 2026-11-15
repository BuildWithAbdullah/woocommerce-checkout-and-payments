<?php
/**
 * The same three scripts, each on the pages that use it, and a cache policy
 * that lets the fragments do the job they exist to do.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_after' );

function acme_enqueue_after() {
	if ( is_checkout() ) {
		wp_enqueue_script( 'wc-checkout' );
	}

	if ( is_cart() ) {
		wp_enqueue_script( 'wc-cart' );
	}

	if ( acme_has_mini_cart_after() ) {
		wp_enqueue_script( 'wc-cart-fragments' );
	}
}

/**
 * The mini cart is in the header on every page of this theme except the
 * checkout, where it is deliberately left out.
 */
function acme_has_mini_cart_after() {
	return ! is_checkout() && ! is_order_received_page();
}

add_action( 'send_headers', 'acme_cart_headers_after' );

function acme_cart_headers_after() {
	if ( is_cart() || is_checkout() || is_account_page() ) {
		nocache_headers();
		return;
	}

	header( 'Cache-Control: public, max-age=60, stale-while-revalidate=600' );
}
