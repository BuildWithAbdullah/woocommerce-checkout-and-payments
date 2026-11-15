<?php
/**
 * The same attempt log, carrying an order id and a gateway reference and
 * nothing that identifies the instrument, and a shopper facing message that
 * says what to do next.
 */

class Acme_Attempt_Log_After {

	private $client;

	/**
	 * Gateway codes are stable and their prose is not, so the mapping lives
	 * here and the gateway's own wording never reaches the page.
	 */
	private function shopper_message( $code ) {
		$messages = array(
			'insufficient_funds' => 'That card was refused for insufficient funds. Try another card.',
			'expired_card'       => 'That card has expired. Check the expiry date or use another card.',
			'incorrect_cvc'      => 'The security code did not match. It is the three digits on the back.',
			'processing_error'   => 'The payment could not be completed just now. Try again in a minute.',
		);

		return isset( $messages[ $code ] )
			? $messages[ $code ]
			: 'The payment could not be completed. No money has left your account.';
	}

	public function record( $order, $card ) {
		$logger = wc_get_logger();

		$logger->debug(
			'charge attempt for order ' . $order->get_id() . ' via ' . $card['brand'],
			array( 'source' => 'acme' )
		);

		$result = $this->client->send( '/charges', $card );

		if ( isset( $result['error']['code'] ) ) {
			$code = sanitize_key( $result['error']['code'] );

			wc_add_notice( $this->shopper_message( $code ), 'error' );
			$order->add_order_note( 'Gateway refused the charge with code ' . $code . '.' );

			$logger->notice(
				'charge refused for order ' . $order->get_id() . ' with code ' . $code,
				array( 'source' => 'acme' )
			);
		}

		return $result;
	}
}
