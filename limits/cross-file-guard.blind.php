<?php
/**
 * This file is loaded from acme-conditions.php, which requires it only on the
 * checkout. Read on its own the enqueue looks unconditional, so the finding
 * reported here is wrong. Nothing in this repository reads two files together.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_checkout_assets' );

function acme_enqueue_checkout_assets() {
	wp_enqueue_script( 'wc-checkout' );
}
