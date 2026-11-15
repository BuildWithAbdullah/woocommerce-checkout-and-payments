<?php
/**
 * Narrower than site wide, and still every category and tag archive pays for
 * a basket request. The fix is the pages that render a mini cart, not the
 * pages that happen to be shop pages.
 */

add_action( 'wp_enqueue_scripts', 'acme_enqueue_fragments_on_archives' );

function acme_enqueue_fragments_on_archives() {
	if ( is_archive() || is_shop() ) {
		wp_enqueue_script( 'wc-cart-fragments' );
	}
}
