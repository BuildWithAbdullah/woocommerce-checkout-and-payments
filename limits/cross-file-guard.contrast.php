<?php
/**
 * The same enqueue with its guard in the same file, which is reported as fine.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_checkout_assets_guarded' );

function acme_enqueue_checkout_assets_guarded() {
	if ( ! is_checkout() ) {
		return;
	}

	wp_enqueue_script( 'wc-checkout' );
}
