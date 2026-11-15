import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php, config } from './support.mjs';

test('tax rounded at the line and again at the total is reported', () => {
  const tokens = php(
    '$line_tax = round( $line_total * $rate, 2 );\n'
    + '$order_total = round( $running_total, 2 );',
  );
  assert.deepEqual(tokens, ['tax-rounded-twice@serious']);
});

test('rounding once at the total is not a finding', () => {
  assert.deepEqual(php('$total_tax = round( $running_tax, 2 );'), []);
});

test('rounding once per line with no total rounding is not a finding', () => {
  assert.deepEqual(php('$line_tax = round( $line_total * $rate, 2 );'), []);
});

test('a gross total shown and a net amount charged is reported', () => {
  const tokens = php(
    'function show( $order ) {\n'
    + '  echo wc_price( $order->get_total() );\n'
    + '}\n'
    + 'function body( $order ) {\n'
    + "  return array(\n    'amount' => $order->get_subtotal(),\n  );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['display-and-charge-tax-mismatch@critical']);
});

test('an amount taken from the same total that was shown is not a finding', () => {
  const tokens = php(
    'function show( $order ) {\n'
    + '  echo wc_price( $order->get_total() );\n'
    + '}\n'
    + 'function body( $order ) {\n'
    + "  return array(\n    'amount' => $order->get_total(),\n  );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a net amount in a file that never shows a gross total is not this finding', () => {
  assert.deepEqual(php("return array( 'amount' => $order->get_subtotal() );"), []);
});

test('a VAT field with no shape check anywhere is reported', () => {
  assert.deepEqual(
    php("$vat = $_POST['billing_vat_number'];"),
    ['vat-number-accepted-unchecked@minor'],
  );
});

test('a VAT field checked with a regular expression is accepted', () => {
  const tokens = php(
    "$vat = $_POST['billing_vat_number'];\n"
    + "if ( ! preg_match( '/^[A-Z]{2}/', $vat ) ) { return; }",
  );
  assert.deepEqual(tokens, []);
});

test('a store with zones and no rest of the world zone is reported', () => {
  const tokens = config({ shipping: { zones: [{ name: 'UK', regions: ['GB'] }] } });
  assert.deepEqual(tokens, ['shipping-zone-no-fallback@serious']);
});

test('a rest of world flag, or a star region, covers the gap', () => {
  assert.deepEqual(
    config({ shipping: { zones: [{ name: 'UK', regions: ['GB'] }, { name: 'Rest', rest_of_world: true }] } }),
    [],
  );
  assert.deepEqual(
    config({ shipping: { zones: [{ name: 'UK', regions: ['GB'] }, { name: 'Rest', regions: ['*'] }] } }),
    [],
  );
});

test('a store with no zones listed is not told about a gap it has not described', () => {
  assert.deepEqual(config({ shipping: {} }), []);
  assert.deepEqual(config({ shipping: { zones: [] } }), []);
});

test('digital goods taxed at the shop base are reported only when the store sells them', () => {
  assert.deepEqual(
    config({ sells_digital_goods: true, tax: { digital_tax_location: 'base' } }),
    ['digital-goods-taxed-at-shop-base@serious'],
  );
  assert.deepEqual(config({ sells_digital_goods: false, tax: { digital_tax_location: 'base' } }), []);
  assert.deepEqual(config({ sells_digital_goods: true, tax: { digital_tax_location: 'customer' } }), []);
});

test('tax taken from the billing address on a store that ships is reported', () => {
  const tokens = config({
    tax: { based_on: 'billing' },
    shipping: { zones: [{ name: 'Rest', rest_of_world: true }] },
  });
  assert.deepEqual(tokens, ['tax-from-billing-while-shipping-elsewhere@serious']);
});

test('tax taken from the shipping address is not a finding', () => {
  const tokens = config({
    tax: { based_on: 'shipping' },
    shipping: { zones: [{ name: 'Rest', rest_of_world: true }] },
  });
  assert.deepEqual(tokens, []);
});

test('zero rated goods recorded as exempt is reported', () => {
  assert.deepEqual(config({ tax: { zero_rate_handling: 'exempt' } }), ['zero-rate-treated-as-exempt@moderate']);
  assert.deepEqual(config({ tax: { zero_rate_handling: 'zero_rate' } }), []);
});

test('a per order flat rate across several classes is reported', () => {
  const tokens = config({
    shipping: {
      classes: ['a', 'b'],
      zones: [{
        name: 'Rest',
        rest_of_world: true,
        methods: [{ type: 'flat_rate', calculation_type: 'order', class_costs: { a: 1, b: 2 } }],
      }],
    },
  });
  assert.deepEqual(tokens, ['shipping-class-cost-applied-once@moderate']);
});

test('the same method charging per class is not a finding', () => {
  const tokens = config({
    shipping: {
      classes: ['a', 'b'],
      zones: [{
        name: 'Rest',
        rest_of_world: true,
        methods: [{ type: 'flat_rate', calculation_type: 'class', class_costs: { a: 1, b: 2 } }],
      }],
    },
  });
  assert.deepEqual(tokens, []);
});

test('one shipping class is not enough for the per class finding to mean anything', () => {
  const tokens = config({
    shipping: {
      classes: ['a'],
      zones: [{
        name: 'Rest',
        rest_of_world: true,
        methods: [{ type: 'flat_rate', calculation_type: 'order', class_costs: { a: 1 } }],
      }],
    },
  });
  assert.deepEqual(tokens, []);
});

test('a free shipping threshold tested before discounts is reported', () => {
  assert.deepEqual(
    config({ shipping: { free_shipping: { min_amount: 50, before_discount: true } } }),
    ['free-shipping-evaluated-before-coupon@moderate'],
  );
  assert.deepEqual(
    config({ shipping: { free_shipping: { min_amount: 50, before_discount: false } } }),
    [],
  );
});

test('a threshold with no amount is not judged', () => {
  assert.deepEqual(config({ shipping: { free_shipping: { before_discount: true } } }), []);
});

test('a JSON file that is not a store description produces nothing rather than throwing', () => {
  assert.deepEqual(config('{"name":"something-else","version":"1.0.0"}'), []);
  assert.deepEqual(config('[1, 2, 3]'), []);
  assert.deepEqual(config('"just a string"'), []);
});

test('a file that is not valid JSON at all produces nothing rather than throwing', () => {
  assert.deepEqual(config('{ not json at all'), []);
});
