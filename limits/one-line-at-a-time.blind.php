<?php
/**
 * The call and its argument are on different lines. Every pattern in this
 * repository is tested against one line at a time, so the handle on the line
 * below the call is not part of what was matched.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_wrapped' );

function acme_enqueue_wrapped() {
	wp_enqueue_script(
		'wc-checkout'
	);
}
