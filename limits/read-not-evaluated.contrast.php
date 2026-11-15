<?php
/**
 * The same two operations written out literally, which is what this reader
 * can see.
 */

class Acme_Direct_Charge {

	private $client;

	public function take( $order ) {
		return $this->client->charge(
			$order->get_total(),
			$order->get_currency()
		);
	}
}

add_action( 'wp_enqueue_scripts', 'acme_enqueue_literal_handle' );

function acme_enqueue_literal_handle() {
	wp_enqueue_script( 'wc-checkout' );
}
