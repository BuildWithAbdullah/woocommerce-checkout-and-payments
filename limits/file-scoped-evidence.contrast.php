<?php
/**
 * The unkeyed charge on its own, where there is nothing to vouch for it.
 */

class Acme_One_Charge {

	private $client;

	public function fire_and_forget( $order ) {
		return $this->client->charge(
			$order->get_total(),
			array()
		);
	}
}
