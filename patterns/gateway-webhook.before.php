<?php
/**
 * A gateway webhook that believes whatever arrives.
 */

add_action( 'woocommerce_api_acme_webhook', 'acme_handle_webhook_before' );

function acme_handle_webhook_before() {
	$payload = file_get_contents( 'php://input' );
	$event   = json_decode( $payload, true );

	$order = wc_get_order( $event['metadata']['order_reference'] );

	if ( ! $order ) {
		status_header( 200 );
		return;
	}

	if ( 'charge.succeeded' === $event['type'] ) {
		$order->update_status( 'completed', 'Paid at the gateway.' );
	}

	if ( 'charge.refunded' === $event['type'] ) {
		$order->update_status( 'refunded', 'Refunded at the gateway.' );
	}

	status_header( 200 );
}
