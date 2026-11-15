<?php
/**
 * No card number here, and still more than belongs in a log file: an expiry
 * date beside the last four narrows a card a long way.
 */

class Acme_Attempt_Trace {

	public function trace( $order, $card ) {
		$logger = wc_get_logger();

		$logger->info(
			'order ' . $order->get_id() . ' paid with ' . $card['last4'] . ' exp ' . $card['exp_month'] . '/' . $card['exp_year'],
			array( 'source' => 'acme' )
		);
	}
}
