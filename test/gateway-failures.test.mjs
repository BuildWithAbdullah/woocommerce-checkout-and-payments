import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php } from './support.mjs';

test('a charge with no idempotency key anywhere in the file is reported', () => {
  assert.deepEqual(
    php('$result = $this->client->charge( $order->get_total() );'),
    ['charge-without-idempotency-key@critical'],
  );
});

test('a charge in a file that mentions an idempotency key is not reported', () => {
  assert.deepEqual(
    php("$result = $this->client->charge( $order->get_total(), array( 'idempotency_key' => $key ) );"),
    [],
  );
});

test('a charge named in a comment is not a charge', () => {
  assert.deepEqual(php('// $this->client->charge( $total );\n$a = 1;'), []);
});

test('a webhook that reads its payload without verifying a signature is reported', () => {
  const tokens = php(
    "add_action( 'woocommerce_api_acme', 'acme_hook' );\n"
    + 'function acme_hook() {\n'
    + "  $body = file_get_contents( 'php://input' );\n"
    + '  $event = json_decode( $body, true );\n'
    + "  $event_id = $event['id'];\n"
    + "  if ( get_transient( 'acme_' . $event_id ) ) { return; }\n"
    + '}',
  );
  assert.deepEqual(tokens, ['webhook-signature-unverified@critical']);
});

test('a webhook that checks a signature with hash equals is accepted', () => {
  const tokens = php(
    "add_action( 'woocommerce_api_acme', 'acme_hook' );\n"
    + 'function acme_hook() {\n'
    + "  $body = file_get_contents( 'php://input' );\n"
    + "  if ( ! hash_equals( hash_hmac( 'sha256', $body, 'k' ), $sig ) ) { return; }\n"
    + '  $event = json_decode( $body, true );\n'
    + "  $event_id = $event['id'];\n"
    + "  if ( get_transient( 'acme_' . $event_id ) ) { return; }\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a webhook with nothing recording which events it has applied is reported', () => {
  const tokens = php(
    "add_action( 'woocommerce_api_acme', 'acme_hook' );\n"
    + 'function acme_hook() {\n'
    + "  if ( ! hash_equals( $a, $b ) ) { return; }\n"
    + "  $event = json_decode( file_get_contents( 'php://input' ), true );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['webhook-not-idempotent@serious']);
});

test('a file that is not a webhook handler is not asked about signatures', () => {
  assert.deepEqual(php("$event = json_decode( file_get_contents( 'php://input' ), true );"), []);
});

test('a timeout that lands on a failed status is reported', () => {
  const tokens = php(
    "if ( false !== strpos( $message, 'timed out' ) ) {\n"
    + "  $order->update_status( 'failed' );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['timeout-treated-as-decline@critical']);
});

test('a timeout that lands on hold is not a decline', () => {
  const tokens = php(
    "if ( $this->is_timeout( $result ) ) {\n"
    + "  $order->update_status( 'on-hold' );\n"
    + '}',
  );
  assert.deepEqual(tokens, []);
});

test('a timeout is reported once however many times the word appears', () => {
  const tokens = php(
    "if ( $this->is_timeout( $r ) ) {\n"
    + "  $order->update_status( 'failed', 'timed out' );\n"
    + '}\n'
    + "if ( $this->timed_out( $r ) ) {\n"
    + "  $order->update_status( 'failed' );\n"
    + '}',
  );
  assert.deepEqual(tokens, ['timeout-treated-as-decline@critical']);
});

test('a card number in a log call is critical', () => {
  assert.deepEqual(
    php("$logger->debug( 'charging ' . $card['card_number'] );"),
    ['card-data-in-log@critical'],
  );
});

test('a security code in a log call is critical too', () => {
  assert.deepEqual(php("error_log( 'cvc ' . $card['cvc'] );"), ['card-data-in-log@critical']);
});

test('an expiry date beside the last four is serious rather than critical', () => {
  assert.deepEqual(
    php("$logger->info( $card['last4'] . ' exp ' . $card['exp_month'] );"),
    ['card-data-in-log@serious'],
  );
});

test('a log call with an order id and a brand is not a finding', () => {
  assert.deepEqual(php("$logger->info( 'order ' . $order->get_id() . ' via ' . $card['brand'] );"), []);
});

test('getting the logger is not itself a log call, so a leak is reported once', () => {
  const tokens = php(
    '$logger = wc_get_logger();\n'
    + "$logger->debug( 'pan ' . $card['card_number'] );",
  );
  assert.deepEqual(tokens, ['card-data-in-log@critical']);
});

test('a gateway error printed for the shopper is moderate', () => {
  assert.deepEqual(
    php("wc_add_notice( $result['error']['message'], 'error' );"),
    ['gateway-error-shown-raw@moderate'],
  );
});

test('an exception message printed for the shopper is moderate', () => {
  assert.deepEqual(php('echo $e->getMessage();'), ['gateway-error-shown-raw@moderate']);
});

test('a gateway error copied into an order note is minor', () => {
  assert.deepEqual(
    php("$order->add_order_note( $result['error']['message'] );"),
    ['gateway-error-shown-raw@minor'],
  );
});

test('a mapped message is not the gateway talking', () => {
  assert.deepEqual(php("wc_add_notice( $this->shopper_message( $code ), 'error' );"), []);
});

test('an HTTP call with no timeout is reported, and one with a timeout is not', () => {
  assert.deepEqual(
    php("wp_remote_post( $url, array( 'body' => $body ) );"),
    ['gateway-call-without-timeout@serious'],
  );
  assert.deepEqual(
    php("wp_remote_post( $url, array( 'timeout' => 15, 'body' => $body ) );"),
    [],
  );
});

test('a timeout on a later line of the same call is found', () => {
  assert.deepEqual(
    php('wp_remote_post(\n  $url,\n  array(\n    \'timeout\' => 15,\n  )\n);'),
    [],
  );
});

test('a paid status while only an authorisation exists is reported', () => {
  const tokens = php(
    "$auth = $client->authorize( $total, array( 'capture' => false ) );\n"
    + "$order->payment_complete( $auth['reference'] );",
  );
  assert.deepEqual(tokens, ['completed-before-capture@critical']);
});

test('the same flow with a capture is accepted', () => {
  const tokens = php(
    "$auth = $client->authorize( $total, array( 'capture' => false ) );\n"
    + "$capture = $client->capture( $auth['reference'] );\n"
    + "$order->payment_complete( $capture['reference'] );",
  );
  assert.deepEqual(tokens, []);
});

test('a redirect with no stored reference and none in the URL is reported', () => {
  assert.deepEqual(
    php("wp_redirect( 'https://pay.example.test/start?merchant=acme' );"),
    ['redirect-flow-loses-order-reference@serious'],
  );
});

test('a redirect preceded by storing the reference is accepted', () => {
  const tokens = php(
    "$order->update_meta_data( '_acme_started', time() );\n"
    + "wp_redirect( 'https://pay.example.test/start' );",
  );
  assert.deepEqual(tokens, []);
});

test('a redirect carrying the order id in the URL is accepted', () => {
  assert.deepEqual(php("wp_redirect( $base . '&order_id=' . $id );"), []);
});

test('a gateway refund with no local refund is reported', () => {
  assert.deepEqual(
    php('$client->refund( $order->get_transaction_id(), $amount );'),
    ['refund-not-recorded-locally@serious'],
  );
});

test('a gateway refund recorded with wc create refund is accepted', () => {
  const tokens = php(
    '$client->refund( $order->get_transaction_id(), $amount );\n'
    + "wc_create_refund( array( 'order_id' => $order->get_id(), 'amount' => $amount ) );",
  );
  assert.deepEqual(tokens, []);
});

test('an endpoint that moves money with no nonce or capability check is reported', () => {
  assert.deepEqual(
    php("add_action( 'wp_ajax_acme_refund_order', 'acme_refund_order' );"),
    ['payment-endpoint-without-nonce@critical'],
  );
});

test('the same endpoint with a nonce check, or a capability check, is accepted', () => {
  assert.deepEqual(
    php("add_action( 'wp_ajax_acme_refund_order', 'acme_refund_order' );\nfunction acme_refund_order() {\n  check_ajax_referer( 'acme' );\n}"),
    [],
  );
  assert.deepEqual(
    php("add_action( 'wp_ajax_acme_refund_order', 'acme_refund_order' );\nfunction acme_refund_order() {\n  if ( ! current_user_can( 'manage_woocommerce' ) ) { return; }\n}"),
    [],
  );
});

test('an endpoint that does not move money is not asked for a nonce by this checker', () => {
  assert.deepEqual(php("add_action( 'wp_ajax_acme_list_countries', 'acme_list_countries' );"), []);
});
