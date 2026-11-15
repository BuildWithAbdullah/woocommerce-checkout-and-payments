<?php
/**
 * Applying a coupon and working out what to charge.
 */

function acme_coupon_is_usable_before( $coupon ) {
	$limit = $coupon->get_usage_limit();
	$used  = $coupon->get_usage_count();

	if ( $limit > 0 && $used >= $limit ) {
		return false;
	}

	$coupon->set_usage_count( $used + 1 );
	$coupon->save();

	return true;
}

function acme_coupon_matches_before( $entered, $coupon ) {
	$code = $coupon->get_code();

	return $code === $entered;
}

function acme_discount_total_before( $cart, $percent ) {
	$tax_already_in = $cart->get_total_tax();
	$discount       = $cart->get_total() * ( $percent / 100 );

	return $discount;
}

function acme_running_total_before( $items ) {
	$total = 0.0;

	foreach ( $items as $item ) {
		$total += floatval( $item['price'] ) * $item['qty'];
	}

	return $total;
}

function acme_gateway_amount_before( $order ) {
	return array(
		'amount'   => $order->get_total() * 100,
		'currency' => $order->get_currency(),
	);
}

function acme_display_total_before( $total ) {
	return floor( $total * 100 ) / 100;
}
