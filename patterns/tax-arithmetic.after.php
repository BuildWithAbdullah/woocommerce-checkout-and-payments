<?php
/**
 * The same three jobs: full precision until the figure is presented, one
 * amount derived from the total that was shown, and a VAT number whose shape
 * is checked before it is allowed to zero rate anything.
 */

/**
 * No rounding here. The caller rounds once, when it has the whole order.
 */
function acme_line_tax_after( $line_total, $rate ) {
	return $line_total * $rate;
}

function acme_order_tax_after( $lines, $rate ) {
	$total_tax = 0;

	foreach ( $lines as $line ) {
		$total_tax += acme_line_tax_after( $line['total'], $rate );
	}

	return round( $total_tax, wc_get_price_decimals() );
}

/**
 * The gateway is sent the same figure the page showed, in minor units, taken
 * from the currency rather than assumed.
 */
function acme_gateway_body_after( $order ) {
	$shown = acme_displayed_total_after( $order );

	return array(
		'amount'   => acme_to_minor_units_after( $shown, $order->get_currency() ),
		'currency' => $order->get_currency(),
	);
}

function acme_displayed_total_after( $order ) {
	return $order->get_total();
}

function acme_to_minor_units_after( $amount, $currency ) {
	$exponents = array(
		'JPY' => 0,
		'KRW' => 0,
		'BHD' => 3,
		'KWD' => 3,
		'TND' => 3,
	);

	$minor_unit = isset( $exponents[ $currency ] ) ? $exponents[ $currency ] : 2;

	return (int) round( $amount * pow( 10, $minor_unit ) );
}

function acme_render_total_after( $order ) {
	echo wc_price( acme_displayed_total_after( $order ) );
}

/**
 * Two letters and then between two and twelve alphanumeric characters is the
 * shape every EU VAT number has. It is not a validation; it is the cheapest
 * way to stop a typo becoming a zero rated sale. Zero rating still waits on
 * the registry answering.
 */
function acme_vat_shape_is_plausible_after( $vat ) {
	return 1 === preg_match( '/^[A-Z]{2}[0-9A-Z]{2,12}$/', strtoupper( trim( $vat ) ) );
}

function acme_save_vat_after( $order_id ) {
	$vat = isset( $_POST['billing_vat_number'] ) ? wp_unslash( $_POST['billing_vat_number'] ) : '';
	$vat = strtoupper( trim( sanitize_text_field( $vat ) ) );

	if ( '' === $vat ) {
		return;
	}

	if ( ! acme_vat_shape_is_plausible_after( $vat ) ) {
		wc_add_notice( 'That VAT number does not look like a VAT number. Check it and try again.', 'error' );
		return;
	}

	update_post_meta( $order_id, '_billing_vat_number', $vat );
	update_post_meta( $order_id, '_billing_vat_verified', 'no' );
}
