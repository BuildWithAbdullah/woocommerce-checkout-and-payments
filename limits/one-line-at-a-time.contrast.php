<?php
/**
 * The same enqueue on one line.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_inline' );

function acme_enqueue_inline() {
	wp_enqueue_script( 'wc-checkout' );
}
