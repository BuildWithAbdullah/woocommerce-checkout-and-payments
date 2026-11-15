import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php, html, CHECKOUT_SHELL } from './support.mjs';

test('the checkout bundle with no page condition is serious', () => {
  assert.deepEqual(
    php("add_action( 'wp_enqueue_scripts', 'go' );\nfunction go() {\n  wp_enqueue_script( 'wc-checkout' );\n}"),
    ['commerce-scripts-on-content-pages@serious'],
  );
});

test('the cart bundle with no page condition is moderate', () => {
  assert.deepEqual(
    php("add_action( 'wp_enqueue_scripts', 'go' );\nfunction go() {\n  wp_enqueue_script( 'wc-cart' );\n}"),
    ['commerce-scripts-on-content-pages@moderate'],
  );
});

test('a guard in the same file is seen', () => {
  assert.deepEqual(
    php('function go() {\n  if ( is_checkout() ) {\n    wp_enqueue_script( \'wc-checkout\' );\n  }\n}'),
    [],
  );
});

test('the fragments handle is not the cart handle, so it is not counted twice', () => {
  const tokens = php("function go() {\n  wp_enqueue_script( 'wc-cart-fragments' );\n}");
  assert.deepEqual(tokens, ['fragments-enqueued-everywhere@serious']);
});

test('a handle that is nothing to do with commerce is left alone', () => {
  assert.deepEqual(php("function go() {\n  wp_enqueue_script( 'acme-slideshow' );\n}"), []);
});

test('the blocks stylesheet on a classic checkout with no block markup is reported', () => {
  const tokens = html('<!doctype html><html><head>'
    + '<link rel="stylesheet" href="/plugins/woocommerce/assets/client/blocks/wc-blocks-style.css">'
    + '</head><body><form class="woocommerce-checkout" action="/c/" method="post">'
    + '<label for="a">Town</label><input id="a" name="billing_city" autocomplete="address-level2">'
    + '<button type="submit">Place order</button></form></body></html>');
  assert.deepEqual(tokens, ['blocks-stylesheet-unused@minor']);
});

test('the blocks stylesheet on a page with block markup is not reported', () => {
  const tokens = html('<!doctype html><html><head>'
    + '<link rel="stylesheet" href="/plugins/woocommerce/assets/client/blocks/wc-blocks-style.css">'
    + '</head><body><div class="wp-block-woocommerce-cart"></div>'
    + '<form class="woocommerce-checkout" action="/c/" method="post">'
    + '<label for="a">Town</label><input id="a" name="billing_city" autocomplete="address-level2">'
    + '<button type="submit">Place order</button></form></body></html>');
  assert.deepEqual(tokens, []);
});

test('the enhanced select on a page with no select element is reported', () => {
  assert.deepEqual(
    html('<!doctype html><html><head></head><body><p>An article.</p>'
      + '<script src="/plugins/woocommerce/assets/js/selectWoo/selectWoo.js" defer></script></body></html>'),
    ['select-enhancement-loaded-site-wide@moderate'],
  );
});

test('the enhanced select on a page that has a select is not reported', () => {
  assert.deepEqual(
    html('<!doctype html><html><head></head><body><label for="c">Country</label>'
      + '<select id="c"><option>GB</option></select>'
      + '<script src="/plugins/woocommerce/assets/js/selectWoo/selectWoo.js" defer></script></body></html>'),
    [],
  );
});

test('a blocking script in the checkout head is reported, and a deferred one is not', () => {
  const page = (attrs) => '<!doctype html><html><head><script src="/a.js"' + attrs + '></script></head>'
    + '<body><form class="woocommerce-checkout" action="/c/" method="post">'
    + '<label for="a">Town</label><input id="a" name="billing_city" autocomplete="address-level2">'
    + '<button type="submit">Place order</button></form></body></html>';
  assert.deepEqual(html(page('')), ['blocking-script-in-checkout-head@moderate']);
  assert.deepEqual(html(page(' defer')), []);
  assert.deepEqual(html(page(' async')), []);
  assert.deepEqual(html(page(' type="module"')), []);
});

test('a blocking script in the head of a page that is not the checkout is not this finding', () => {
  assert.deepEqual(
    html('<!doctype html><html><head><script src="/a.js"></script></head><body><p>An article.</p></body></html>'),
    [],
  );
});

test('a script at the end of the body of a checkout is not in the head', () => {
  const tokens = html('<!doctype html><html><head></head>'
    + '<body><form class="woocommerce-checkout" action="/c/" method="post">'
    + '<label for="a">Town</label><input id="a" name="billing_city" autocomplete="address-level2">'
    + '<button type="submit">Place order</button></form><script src="/a.js"></script></body></html>');
  assert.deepEqual(tokens, []);
});

test('a gateway library whose gateway is not on offer is reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset class="payment_methods"><legend>Payment</legend>\n'
    + '    <p><input type="radio" name="payment_method" id="a" value="paypal" checked><label for="a">PayPal</label></p>\n'
    + '    <p><input type="radio" name="payment_method" id="b" value="bacs"><label for="b">Bank</label></p>\n'
    + '  </fieldset>\n'
    + '  <script src="https://js.stripe.com/v3/" defer></script>',
  ));
  assert.deepEqual(tokens, ['gateway-sdk-loaded-when-unavailable@moderate']);
});

test('a gateway library whose gateway is on offer is not reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset class="payment_methods"><legend>Payment</legend>\n'
    + '    <p><input type="radio" name="payment_method" id="a" value="stripe" checked><label for="a">Card</label></p>\n'
    + '    <p><input type="radio" name="payment_method" id="b" value="bacs"><label for="b">Bank</label></p>\n'
    + '  </fieldset>\n'
    + '  <script src="https://js.stripe.com/v3/" defer></script>',
  ));
  assert.deepEqual(tokens, []);
});

test('two copies of one gateway library on a page is reported once', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset class="payment_methods"><legend>Payment</legend>\n'
    + '    <p><input type="radio" name="payment_method" id="a" value="stripe" checked><label for="a">Card</label></p>\n'
    + '    <p><input type="radio" name="payment_method" id="b" value="bacs"><label for="b">Bank</label></p>\n'
    + '  </fieldset>\n'
    + '  <script src="https://js.stripe.com/v3/" defer></script>\n'
    + '  <script src="https://js.stripe.com/v3/" defer></script>',
  ));
  assert.deepEqual(tokens, ['gateway-sdk-loaded-twice@serious']);
});

test('a script that is not a gateway library is not counted as one', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <script src="/wp-content/themes/acme/main.js" defer></script>\n'
    + '  <script src="/wp-content/themes/acme/main.js" defer></script>',
  ));
  assert.deepEqual(tokens, []);
});
