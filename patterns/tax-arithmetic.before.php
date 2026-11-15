<?php
/**
 * Working out tax, sending an amount, and taking a VAT number.
 */

function acme_line_tax_before( $line_total, $rate ) {
	$line_tax = round( $line_total * $rate, 2 );

	return $line_tax;
}

function acme_order_tax_before( $lines, $rate ) {
	$total_tax = 0;

	foreach ( $lines as $line ) {
		$total_tax += acme_line_tax_before( $line['total'], $rate );
	}

	return round( $total_tax, 2 );
}

function acme_gateway_body_before( $order ) {
	return array(
		'amount'   => $order->get_subtotal(),
		'currency' => $order->get_currency(),
	);
}

function acme_render_total_before( $order ) {
	echo wc_price( $order->get_total() );
}

function acme_save_vat_before( $order_id ) {
	$vat = isset( $_POST['billing_vat_number'] ) ? wp_unslash( $_POST['billing_vat_number'] ) : '';

	update_post_meta( $order_id, '_billing_vat_number', $vat );
}
