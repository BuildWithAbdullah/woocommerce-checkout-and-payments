<?php
/**
 * The same handler, with the signature checked before anything is read, the
 * event id recorded so a redelivery is a no-op, and transitions that refuse
 * to go backwards.
 */

add_action( 'woocommerce_api_acme_webhook', 'acme_handle_webhook_after' );

function acme_handle_webhook_after() {
	$payload   = file_get_contents( 'php://input' );
	$signature = isset( $_SERVER['HTTP_ACME_SIGNATURE'] ) ? wp_unslash( $_SERVER['HTTP_ACME_SIGNATURE'] ) : '';
	$expected  = hash_hmac( 'sha256', $payload, acme_webhook_secret() );

	if ( ! hash_equals( $expected, $signature ) ) {
		status_header( 400 );
		return;
	}

	$event    = json_decode( $payload, true );
	$event_id = isset( $event['id'] ) ? sanitize_text_field( $event['id'] ) : '';

	if ( '' === $event_id || get_transient( 'acme_event_' . $event_id ) ) {
		status_header( 200 );
		return;
	}

	$order = wc_get_order( $event['metadata']['order_reference'] );

	if ( ! $order ) {
		set_transient( 'acme_event_' . $event_id, 1, WEEK_IN_SECONDS );
		status_header( 200 );
		return;
	}

	acme_apply_webhook_event( $order, $event );

	set_transient( 'acme_event_' . $event_id, 1, WEEK_IN_SECONDS );
	status_header( 200 );
}

/**
 * A refunded or cancelled order is a terminal state as far as a late
 * authorisation event is concerned.
 */
function acme_apply_webhook_event( $order, $event ) {
	$current = $order->get_status();

	if ( in_array( $current, array( 'refunded', 'cancelled' ), true ) ) {
		$order->add_order_note( 'Ignored a late ' . $event['type'] . ' event.' );
		return;
	}

	if ( 'charge.succeeded' === $event['type'] ) {
		$order->payment_complete( $event['data']['reference'] );
		return;
	}

	if ( 'charge.refunded' === $event['type'] ) {
		wc_create_refund(
			array(
				'order_id' => $order->get_id(),
				'amount'   => $event['data']['amount_refunded'],
				'reason'   => 'Refunded at the gateway.',
			)
		);
	}
}
