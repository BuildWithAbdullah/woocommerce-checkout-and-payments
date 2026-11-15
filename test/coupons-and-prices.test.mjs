import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php } from './support.mjs';

test('a usage count read and then written with nothing in between is reported', () => {
  const tokens = php(
    '$used = $coupon->get_usage_count();\n'
    + 'if ( $used >= $limit ) { return false; }\n'
    + '$coupon->set_usage_count( $used + 1 );',
  );
  assert.deepEqual(tokens, ['usage-limit-checked-without-lock@serious']);
});

test('a conditional update on the count it read is accepted', () => {
  const tokens = php(
    '$used = $coupon->get_usage_count();\n'
    + '$claimed = $wpdb->query( $wpdb->prepare( "UPDATE t SET usage_count = usage_count + 1'
    + ' WHERE id = %d AND usage_count < %d", $id, $limit ) );',
  );
  assert.deepEqual(tokens, []);
});

test('reading a usage count without writing one is not a race', () => {
  assert.deepEqual(php('$used = $coupon->get_usage_count();'), []);
});

test('a percentage discount taken off a tax inclusive total is reported', () => {
  const tokens = php(
    '$tax = $cart->get_total_tax();\n'
    + '$discount = $cart->get_total() * ( $percent / 100 );',
  );
  assert.deepEqual(tokens, ['discount-applied-after-tax@serious']);
});

test('a discount on net line amounts is not reported', () => {
  const tokens = php(
    '$tax = $cart->get_total_tax();\n'
    + '$discount = $net_line_total * ( $percent / 100 );',
  );
  assert.deepEqual(tokens, []);
});

test('a multiplication of a total that is nothing to do with a discount is not reported', () => {
  const tokens = php(
    '$tax = $cart->get_total_tax();\n'
    + '$in_pence = $cart->get_total() * $rate_of_exchange;',
  );
  assert.deepEqual(tokens, []);
});

test('money converted to a float is reported', () => {
  assert.deepEqual(php("$total += floatval( $item['price'] );"), ['money-held-as-float@serious']);
  assert.deepEqual(php("$total += (float) $item_price;"), ['money-held-as-float@serious']);
});

test('money kept in integer minor units is not reported', () => {
  assert.deepEqual(php("$total_minor += (int) $item['price_minor'];"), []);
});

test('an amount multiplied by a hundred for the gateway is reported', () => {
  assert.deepEqual(
    php("return array( 'amount' => $order->get_total() * 100 );"),
    ['minor-units-assumed-two@critical'],
  );
});

test('the same amount built from the currency exponent is not reported', () => {
  assert.deepEqual(
    php("$minor_unit = acme_minor_unit( $currency );\n"
      + "return array( 'amount' => (int) round( $order->get_total() * pow( 10, $minor_unit ) ) );"),
    [],
  );
});

test('multiplying and dividing by a hundred on one line is rounding, not minor units', () => {
  assert.deepEqual(php('return floor( $value * 100 ) / 100;'), []);
});

test('a coupon code compared as it was typed is reported', () => {
  const tokens = php(
    '$code = $coupon->get_code();\n'
    + 'return $code === $entered;',
  );
  assert.deepEqual(tokens, ['coupon-code-matched-case-sensitively@moderate']);
});

test('a coupon code normalised on both sides is accepted', () => {
  const tokens = php(
    '$code = wc_format_coupon_code( $coupon->get_code() );\n'
    + 'return $code === wc_format_coupon_code( $entered );',
  );
  assert.deepEqual(tokens, []);
});

test('a comparison in a file that is nothing to do with coupons is not reported', () => {
  assert.deepEqual(php("$code = $response['status_code'];\nreturn $code === $expected;"), []);
});

test('a total truncated rather than rounded is reported', () => {
  assert.deepEqual(php('return floor( $total_pence );'), ['total-rounded-toward-zero@minor']);
  assert.deepEqual(php('return (int) $amount_due;'), ['total-rounded-toward-zero@minor']);
  assert.deepEqual(php('return intval( $price_each );'), ['total-rounded-toward-zero@minor']);
});

test('rounding half up is not reported', () => {
  assert.deepEqual(php('return round( $total, 0, PHP_ROUND_HALF_UP );'), []);
});

test('truncating something that is not money is not reported', () => {
  assert.deepEqual(php('return floor( $days_remaining );'), []);
});
