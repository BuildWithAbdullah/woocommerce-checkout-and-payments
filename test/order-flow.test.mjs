import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php } from './support.mjs';

test('work on the order received page with nothing recording it is reported', () => {
  const tokens = php(
    "add_action( 'woocommerce_thankyou', 'notify' );\n"
    + 'function notify( $order_id ) {\n'
    + "  wp_remote_post( 'https://w.test/o', array( 'timeout' => 5 ) );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['thankyou-side-effect-not-idempotent@critical']);
});

test('the same work guarded by a flag on the order is accepted', () => {
  const tokens = php(
    "add_action( 'woocommerce_thankyou', 'notify' );\n"
    + 'function notify( $order_id ) {\n'
    + '  $order = wc_get_order( $order_id );\n'
    + "  if ( $order->get_meta( '_notified' ) ) { return; }\n"
    + "  wp_remote_post( 'https://w.test/o', array( 'timeout' => 5 ) );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a thankyou callback that only reads is not a side effect', () => {
  const tokens = php(
    "add_action( 'woocommerce_thankyou', 'show' );\n"
    + 'function show( $order_id ) {\n'
    + '  $order = wc_get_order( $order_id );\n'
    + '  echo esc_html( $order->get_billing_city() );\n'
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('stock reduced when the order is created is reported', () => {
  const tokens = php(
    "add_action( 'woocommerce_checkout_order_processed', 'reduce' );\n"
    + 'function reduce( $order_id ) {\n'
    + '  wc_reduce_stock_levels( $order_id );\n'
    + '}',
  );
  assert.deepEqual(tokens, ['stock-reduced-before-payment@serious']);
});

test('stock reduced on payment complete is not this finding', () => {
  const tokens = php(
    "add_action( 'woocommerce_payment_complete', 'reduce' );\n"
    + 'function reduce( $order_id ) {\n'
    + '  wc_reduce_stock_levels( $order_id );\n'
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('an order moved to processing at creation with no paid check is reported', () => {
  const tokens = php(
    "add_action( 'woocommerce_checkout_order_processed', 'mark' );\n"
    + 'function mark( $order_id, $data, $order ) {\n'
    + "  if ( ! $order->has_status( 'pending' ) ) { return; }\n"
    + "  $order->update_status( 'processing' );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['processing-email-for-unpaid-order@moderate']);
});

test('the same callback checking the order is paid is accepted', () => {
  const tokens = php(
    "add_action( 'woocommerce_checkout_order_processed', 'mark' );\n"
    + 'function mark( $order_id, $data, $order ) {\n'
    + '  if ( ! $order->is_paid() ) { return; }\n'
    + "  if ( ! $order->has_status( 'pending' ) ) { return; }\n"
    + "  $order->update_status( 'processing' );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a status set in a hooked file that never reads a status is reported', () => {
  const tokens = php(
    "add_action( 'acme_event', 'apply' );\n"
    + 'function apply( $order ) {\n'
    + "  $order->update_status( 'completed' );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['status-set-without-guard@critical']);
});

test('a status set after reading the current one is accepted', () => {
  const tokens = php(
    "add_action( 'acme_event', 'apply' );\n"
    + 'function apply( $order ) {\n'
    + '  $current = $order->get_status();\n'
    + "  if ( 'refunded' === $current ) { return; }\n"
    + "  $order->update_status( 'completed' );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('has status counts as reading the status', () => {
  const tokens = php(
    "add_action( 'acme_event', 'apply' );\n"
    + 'function apply( $order ) {\n'
    + "  if ( ! $order->has_status( array( 'pending', 'on-hold' ) ) ) { return; }\n"
    + "  $order->update_status( 'completed' );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a status set in a file with no hooks is not this checker business', () => {
  assert.deepEqual(php("$order->update_status( 'completed' );"), []);
});

test('an order loaded from a request id with no key check is reported', () => {
  const tokens = php(
    "$order_id = absint( $_GET['order_id'] );\n"
    + '$order = wc_get_order( $order_id );',
  );
  assert.deepEqual(tokens, ['order-received-without-key-check@critical']);
});

test('the same load with the key compared is accepted', () => {
  const tokens = php(
    "$order_id = absint( $_GET['order_id'] );\n"
    + '$order = wc_get_order( $order_id );\n'
    + "if ( ! hash_equals( $order->get_order_key(), $_GET['key'] ) ) { return; }",
  );
  assert.deepEqual(tokens, []);
});

test('an order loaded from something other than the request is not this finding', () => {
  assert.deepEqual(php('$order = wc_get_order( $this->order_id );'), []);
});

test('an account created at checkout and never attached to the order is reported', () => {
  assert.deepEqual(
    php("$customer_id = wc_create_new_customer( $email, $username );"),
    ['guest-order-not-linked-on-signup@minor'],
  );
});

test('the same account attached with set customer id is accepted', () => {
  const tokens = php(
    '$customer_id = wc_create_new_customer( $email, $username );\n'
    + '$order->set_customer_id( $customer_id );',
  );
  assert.deepEqual(tokens, []);
});
