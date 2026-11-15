<?php
/**
 * The same five operations in integer minor units, with the usage limit
 * enforced by the update rather than by the read, and the discount taken off
 * the net amounts so the tax figure still matches the goods.
 */

/**
 * The increment is the check. A conditional UPDATE that matches on the count
 * we read either affects one row, in which case this checkout holds the use,
 * or affects none, in which case somebody else got there first. Reading the
 * count and then writing it back loses that race every time two shoppers
 * redeem the last use together.
 */
function acme_coupon_claim_use_after( $coupon_id, $limit ) {
	global $wpdb;

	$claimed = $wpdb->query(
		$wpdb->prepare(
			"UPDATE {$wpdb->prefix}acme_coupon_usage
			    SET usage_count = usage_count + 1
			  WHERE coupon_id = %d
			    AND usage_count < %d",
			$coupon_id,
			$limit
		)
	);

	return 1 === (int) $claimed;
}

/**
 * Coupon codes are not case sensitive to the shopper, whatever the flyer they
 * were printed on did with them.
 */
function acme_coupon_matches_after( $entered, $coupon ) {
	$stored  = wc_format_coupon_code( $coupon->get_code() );
	$offered = wc_format_coupon_code( $entered );

	return $stored === $offered;
}

/**
 * Discount the net lines, then let tax be recalculated on what is left. The
 * other order produces a tax figure that does not correspond to any goods.
 */
function acme_discount_net_lines_after( $net_line_minor, $percent ) {
	$discounted = array();

	foreach ( $net_line_minor as $key => $minor ) {
		$discounted[ $key ] = $minor - acme_round_half_up_after( $minor * $percent / 100 );
	}

	return $discounted;
}

function acme_running_total_after( $items ) {
	$total_minor = 0;

	foreach ( $items as $item ) {
		$total_minor += (int) $item['price_minor'] * (int) $item['qty'];
	}

	return $total_minor;
}

function acme_minor_unit_for_after( $currency ) {
	$exponents = array(
		'JPY' => 0,
		'KRW' => 0,
		'VND' => 0,
		'BHD' => 3,
		'KWD' => 3,
		'TND' => 3,
	);

	return isset( $exponents[ $currency ] ) ? $exponents[ $currency ] : 2;
}

function acme_gateway_amount_after( $order ) {
	$minor_unit = acme_minor_unit_for_after( $order->get_currency() );

	return array(
		'amount'   => (int) acme_round_half_up_after( $order->get_total() * pow( 10, $minor_unit ) ),
		'currency' => $order->get_currency(),
	);
}

/**
 * Half up, so the figure shown and the figure charged are the same figure.
 */
function acme_round_half_up_after( $value ) {
	return round( $value, 0, PHP_ROUND_HALF_UP );
}

function acme_display_total_after( $total_minor, $currency ) {
	$minor_unit = acme_minor_unit_for_after( $currency );

	return $total_minor / pow( 10, $minor_unit );
}
