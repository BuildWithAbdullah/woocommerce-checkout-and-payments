// Shared helpers for the checker tests. Not a test file: the suite's file list
// lives in the test script in package.json and names every file explicitly.

import { makeDoc, checkDoc, tokensOf } from '../src/run.mjs';

export function run(path, source) {
  return checkDoc(makeDoc(path, source));
}

export function tokensFor(path, source) {
  return tokensOf(run(path, source));
}

export function idsFor(path, source) {
  return [...new Set(run(path, source).map((f) => f.id))].sort();
}

export function html(source) {
  return tokensFor('case.html', source);
}

export function php(source) {
  return tokensFor('case.php', '<?php\n' + source);
}

export function js(source) {
  return tokensFor('case.js', source);
}

export function config(value) {
  return tokensFor('case.json', typeof value === 'string' ? value : JSON.stringify(value));
}

export function conf(source) {
  return tokensFor('case.conf', source);
}

// A minimal classic checkout, so a case only has to carry the thing it is
// about. Every field in it is correct, which is asserted by a test of its own.
export const CHECKOUT_SHELL = (body) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Checkout</title></head>
<body>
<form name="checkout" class="checkout woocommerce-checkout" method="post" action="/checkout/">
${body}
  <button type="submit" name="woocommerce_checkout_place_order">Place order</button>
</form>
</body>
</html>`;

export function onlyId(tokens, id) {
  return tokens.filter((t) => t.startsWith(id + '@'));
}
