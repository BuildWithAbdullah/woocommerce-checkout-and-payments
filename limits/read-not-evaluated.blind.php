<?php
/**
 * Both of these are invisible to a reader that matches source text. The charge
 * goes through a callable rather than a named method, and the script handle is
 * assembled from two pieces.
 */

class Acme_Indirect_Charge {

	private $client;

	public function take( $order ) {
		$method = 'charge';

		return call_user_func(
			array( $this->client, $method ),
			$order->get_total(),
			$order->get_currency()
		);
	}
}

add_action( 'wp_enqueue_scripts', 'acme_enqueue_assembled_handle' );

function acme_enqueue_assembled_handle() {
	$prefix = 'wc-';

	wp_enqueue_script( $prefix . 'checkout' );
}
