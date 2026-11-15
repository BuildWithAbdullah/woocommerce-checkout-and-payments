<?php
/**
 * Taking a payment and deciding what the gateway's silence means.
 */

class Acme_Payments_Before {

	private $client;

	public function __construct( $client ) {
		$this->client = $client;
	}

	public function process_payment( $order_id ) {
		$order  = wc_get_order( $order_id );
		$result = $this->client->charge( $order->get_total(), $order->get_currency() );

		if ( is_wp_error( $result ) ) {
			$message = $result->get_error_message();

			if ( false !== strpos( $message, 'timed out' ) ) {
				$order->update_status( 'failed', 'The payment timed out.' );
				return array( 'result' => 'failure' );
			}

			$order->update_status( 'failed', 'The payment was declined.' );
			return array( 'result' => 'failure' );
		}

		$order->payment_complete( $result['reference'] );
		return array( 'result' => 'success' );
	}
}

class Acme_Gateway_Client_Before {

	private $secret;

	public function __construct( $secret ) {
		$this->secret = $secret;
	}

	public function send( $path, $body ) {
		return wp_remote_post(
			'https://api.example-gateway.test/v1' . $path,
			array(
				'headers' => array( 'Authorization' => 'Bearer ' . $this->secret ),
				'body'    => $body,
			)
		);
	}
}
