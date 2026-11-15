<?php
/**
 * Logging a payment attempt, and telling the shopper what went wrong.
 */

class Acme_Attempt_Log_Before {

	private $client;

	public function record( $order, $card ) {
		$logger = wc_get_logger();

		$logger->debug(
			'charging card ' . $card['card_number'] . ' cvc ' . $card['cvc'],
			array( 'source' => 'acme' )
		);

		$result = $this->client->send( '/charges', $card );

		if ( isset( $result['error']['message'] ) ) {
			wc_add_notice( $result['error']['message'], 'error' );
			$order->add_order_note( 'Gateway said: ' . $result['error']['message'] );
		}

		return $result;
	}
}
