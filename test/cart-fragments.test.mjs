import { test } from 'node:test';
import assert from 'node:assert/strict';

import { php, js, html, conf } from './support.mjs';

test('the fragments script with no page condition at all is serious', () => {
  assert.deepEqual(
    php("add_action( 'wp_enqueue_scripts', 'go' );\nfunction go() {\n  wp_enqueue_script( 'wc-cart-fragments' );\n}"),
    ['fragments-enqueued-everywhere@serious'],
  );
});

test('the fragments script behind a shop or archive condition is moderate rather than serious', () => {
  assert.deepEqual(
    php('function go() {\n  if ( is_archive() ) {\n    wp_enqueue_script( \'wc-cart-fragments\' );\n  }\n}'),
    ['fragments-enqueued-everywhere@moderate'],
  );
});

test('the fragments script behind a mini cart condition is not a finding', () => {
  assert.deepEqual(
    php('function go() {\n  if ( has_mini_cart() ) {\n    wp_enqueue_script( \'wc-cart-fragments\' );\n  }\n}'),
    [],
  );
});

test('the fragments script on the cart or checkout is not a finding', () => {
  assert.deepEqual(
    php('function go() {\n  if ( is_cart() || is_checkout() ) {\n    wp_enqueue_script( \'wc-cart-fragments\' );\n  }\n}'),
    [],
  );
});

test('a no cache header sent because of a cart cookie is reported', () => {
  assert.deepEqual(
    php("if ( isset( $_COOKIE['woocommerce_items_in_cart'] ) ) {\n  nocache_headers();\n}"),
    ['cart-cookie-disables-page-cache@serious'],
  );
});

test('a no cache header on the cart and checkout pages is not a finding', () => {
  assert.deepEqual(
    php('if ( is_cart() || is_checkout() ) {\n  nocache_headers();\n}'),
    [],
  );
});

test('the same rule written in a server config is reported', () => {
  const tokens = conf(
    'RewriteCond %{HTTP_COOKIE} woocommerce_items_in_cart\n'
    + 'Header set Cache-Control "no-cache, no-store"\n',
  );
  assert.deepEqual(tokens, ['cart-cookie-disables-page-cache@serious']);
});

test('a server config caching normally is not a finding', () => {
  assert.deepEqual(conf('Header set Cache-Control "public, max-age=60"\n'), []);
});

test('a fragment refresh with nothing kept between pages is reported', () => {
  assert.deepEqual(
    js('function refreshFragments() {\n  return fetch(url);\n}\n'),
    ['fragments-not-cached-in-session@moderate'],
  );
});

test('a fragment refresh that keeps its answer in session storage is not reported', () => {
  assert.deepEqual(
    js('function refreshFragments() {\n  return fetch(url).then(function (r) {\n'
      + '    window.sessionStorage.setItem("f", r);\n  });\n}\n'),
    [],
  );
});

test('a file with nothing to do with fragments is left alone', () => {
  assert.deepEqual(js('function slideshow() {\n  return 1;\n}\n'), []);
});

test('a refresh fired from a ready handler is reported as being in the critical path', () => {
  const tokens = js(
    'window.sessionStorage.getItem("x");\n'
    + 'document.addEventListener("DOMContentLoaded", function () {\n'
    + '  refreshFragments();\n'
    + '});\n',
  );
  assert.deepEqual(tokens, ['fragments-request-in-critical-path@moderate']);
});

test('a refresh fired after load is not in the critical path', () => {
  const tokens = js(
    'window.sessionStorage.getItem("x");\n'
    + 'window.addEventListener("load", function () {\n'
    + '  refreshFragments();\n'
    + '});\n',
  );
  assert.deepEqual(tokens, []);
});

test('a refresh bound to scrolling is reported', () => {
  const tokens = js(
    'window.sessionStorage.getItem("x");\n'
    + 'window.addEventListener("scroll", function () {\n'
    + '  refreshFragments();\n'
    + '});\n',
  );
  assert.deepEqual(tokens, ['fragments-refresh-on-frequent-event@serious']);
});

test('a refresh bound to the cart changing is not reported', () => {
  const tokens = js(
    'window.sessionStorage.getItem("x");\n'
    + 'document.body.addEventListener("acme_cart_changed", function () {\n'
    + '  refreshFragments();\n'
    + '});\n',
  );
  assert.deepEqual(tokens, []);
});

test('a scroll handler that does not touch the fragments is left alone', () => {
  const tokens = js(
    'window.sessionStorage.getItem("x");\n'
    + 'refreshFragments();\n'
    + 'window.addEventListener("scroll", function () {\n'
    + '  header.classList.toggle("stuck");\n'
    + '});\n',
  );
  assert.deepEqual(tokens, []);
});

test('an empty basket count is reported, and one with a number in it is not', () => {
  assert.deepEqual(
    html('<a class="cart-contents"><span class="cart-contents-count"></span></a>'),
    ['cart-count-has-no-server-value@moderate'],
  );
  assert.deepEqual(
    html('<a class="cart-contents"><span class="cart-contents-count">3</span></a>'),
    [],
  );
});

test('an empty basket count with the value in a data attribute is accepted', () => {
  assert.deepEqual(
    html('<span class="cart-contents-count" data-count="0"></span>'),
    [],
  );
});
