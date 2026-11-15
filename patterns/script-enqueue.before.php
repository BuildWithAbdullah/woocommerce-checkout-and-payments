<?php
/**
 * What the theme loads, and what it does to the page cache.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_before' );

function acme_enqueue_before() {
	wp_enqueue_script( 'wc-checkout' );
	wp_enqueue_script( 'wc-cart' );
	wp_enqueue_script( 'wc-cart-fragments' );
}

add_action( 'send_headers', 'acme_cart_headers_before' );

function acme_cart_headers_before() {
	if ( isset( $_COOKIE['woocommerce_items_in_cart'] ) ) {
		nocache_headers();
	}
}
