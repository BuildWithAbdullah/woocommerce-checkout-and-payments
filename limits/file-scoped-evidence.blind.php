<?php
/**
 * Two charges. One carries an idempotency key and one does not, and the
 * evidence is looked for across the whole file, so the keyed call vouches for
 * the unkeyed one.
 */

class Acme_Two_Charges {

	private $client;

	public function retry_safe( $order ) {
		return $this->client->charge(
			$order->get_total(),
			array( 'idempotency_key' => $order->get_meta( '_acme_attempt_key' ) )
		);
	}

	public function fire_and_forget( $order ) {
		return $this->client->charge(
			$order->get_total(),
			array()
		);
	}
}
