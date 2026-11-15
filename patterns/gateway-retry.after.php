<?php
/**
 * The same flow, with an idempotency key, an explicit timeout, and a timeout
 * that is treated as an unknown outcome rather than as a refusal.
 */

class Acme_Payments_After {

	private $client;

	public function __construct( $client ) {
		$this->client = $client;
	}

	public function process_payment( $order_id ) {
		$order = wc_get_order( $order_id );
		$key   = $this->idempotency_key( $order );

		$result = $this->client->charge(
			$order->get_total(),
			$order->get_currency(),
			$key
		);

		if ( is_wp_error( $result ) ) {
			if ( 'acme_declined' === $result->get_error_code() ) {
				$order->update_status( 'failed', 'The bank refused the payment.' );
				return array( 'result' => 'failure' );
			}

			$order->update_meta_data( '_acme_attempt_key', $key );
			$order->update_status( 'on-hold', 'The gateway did not answer. Reconciling before anything else happens.' );
			$order->save();

			return array( 'result' => 'pending' );
		}

		$order->payment_complete( $result['reference'] );
		return array( 'result' => 'success' );
	}

	/**
	 * One key per attempt, not one per request, so every retry of the same
	 * attempt is the same key and the gateway can collapse them.
	 */
	private function idempotency_key( $order ) {
		$existing = $order->get_meta( '_acme_attempt_key' );

		if ( $existing ) {
			return $existing;
		}

		return 'acme-' . $order->get_id() . '-' . wp_generate_uuid4();
	}
}

class Acme_Gateway_Client_After {

	private $secret;

	public function __construct( $secret ) {
		$this->secret = $secret;
	}

	public function send( $path, $body, $idempotency_key = '' ) {
		return wp_remote_post(
			'https://api.example-gateway.test/v1' . $path,
			array(
				'timeout' => 15,
				'headers' => array(
					'Authorization'   => 'Bearer ' . $this->secret,
					'Idempotency-Key' => $idempotency_key,
				),
				'body'    => $body,
			)
		);
	}
}
