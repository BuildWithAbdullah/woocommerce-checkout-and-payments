import { test } from 'node:test';
import assert from 'node:assert/strict';

import { html, CHECKOUT_SHELL } from './support.mjs';

const RADIOS = `  <fieldset class="payment_methods">
    <legend>Payment</legend>
    <p><input type="radio" name="payment_method" id="pm_a" value="card" checked>
       <label for="pm_a">Card</label></p>
    <p><input type="radio" name="payment_method" id="pm_b" value="bacs">
       <label for="pm_b">Bank transfer</label></p>
  </fieldset>`;

test('a correct payment method group produces nothing', () => {
  assert.deepEqual(html(CHECKOUT_SHELL(RADIOS)), []);
});

test('clickable items with no radios are reported as not being a choice', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <div class="payment_methods">\n'
    + '    <div class="method" data-payment-method="card"><span>Card</span></div>\n'
    + '    <div class="method" data-payment-method="bacs"><span>Bank</span></div>\n'
    + '  </div>',
  ));
  assert.deepEqual(tokens, ['payment-list-not-radiogroup@critical']);
});

test('one clickable item is not enough to call it a replaced choice', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <div class="payment_methods">\n'
    + '    <div class="method" data-payment-method="card"><span>Card</span></div>\n'
    + '  </div>',
  ));
  assert.deepEqual(tokens, []);
});

test('a fieldset is recognised as the payment list, which is the markup WooCommerce ships beside a ul', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset class="payment_methods">\n'
    + '    <legend>Payment</legend>\n'
    + '    <div class="method" data-payment-method="card"><span>Card</span></div>\n'
    + '    <div class="method" data-payment-method="bacs"><span>Bank</span></div>\n'
    + '  </fieldset>',
  ));
  assert.deepEqual(tokens, ['payment-list-not-radiogroup@critical']);
});

test('radios in one list with different names are reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset class="payment_methods"><legend>Payment</legend>\n'
    + '    <p><input type="radio" name="pm_card" id="a" value="card"><label for="a">Card</label></p>\n'
    + '    <p><input type="radio" name="pm_bacs" id="b" value="bacs"><label for="b">Bank</label></p>\n'
    + '  </fieldset>',
  ));
  assert.deepEqual(tokens, ['payment-radio-no-name@serious']);
});

test('a saved card token group alongside the method group is not a name mistake', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <div class="saved-cards">\n'
    + '    <p><input type="radio" name="wc-card-payment-token" id="t1" value="1">\n'
    + '       <label for="t1">Visa ending 4242</label></p>\n'
    + '  </div>',
  ));
  assert.deepEqual(tokens, []);
});

test('a payment iframe with no title is reported, and one with a title is not', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL(RADIOS + '\n  <iframe src="https://js.stripe.com/v3/card.html" class="card-frame"></iframe>')),
    ['gateway-iframe-untitled@serious'],
  );
  assert.deepEqual(
    html(CHECKOUT_SHELL(RADIOS + '\n  <iframe src="https://js.stripe.com/v3/card.html" class="card-frame" title="Card number"></iframe>')),
    [],
  );
});

test('an iframe that is nothing to do with payment is not held to the rule', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL(RADIOS + '\n  <iframe src="https://maps.example.test/store"></iframe>')),
    [],
  );
});

test('a negative tabindex on the card frame is reported as unreachable', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n  <iframe src="https://js.stripe.com/v3/card.html" class="card-frame" title="Card number" tabindex="-1"></iframe>',
  ));
  assert.deepEqual(tokens, ['gateway-iframe-not-reachable@critical']);
});

test('aria hidden on the card frame is reported as unreachable too', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n  <iframe src="https://js.stripe.com/v3/card.html" class="card-frame" title="Card number" aria-hidden="true"></iframe>',
  ));
  assert.deepEqual(tokens, ['gateway-iframe-not-reachable@critical']);
});

test('a tabindex of zero on the card frame is not a complaint', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n  <iframe src="https://js.stripe.com/v3/card.html" class="card-frame" title="Card number" tabindex="0"></iframe>',
  ));
  assert.deepEqual(tokens, []);
});

test('a payment panel that is neither focus managed nor announced is reported', () => {
  const tokens = html(CHECKOUT_SHELL(RADIOS + '\n  <div class="payment_box" id="box"><p>Card details</p></div>'));
  assert.deepEqual(tokens, ['payment-box-not-announced@serious']);
});

test('a panel with a tabindex, or named and controlled by its radio, is accepted', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL(RADIOS + '\n  <div class="payment_box" id="box" tabindex="-1"><p>Card details</p></div>')),
    [],
  );
  const controlled = `  <fieldset class="payment_methods">
    <legend>Payment</legend>
    <p><input type="radio" name="payment_method" id="pm_a" value="card" aria-controls="box" checked>
       <label for="pm_a">Card</label></p>
    <p><input type="radio" name="payment_method" id="pm_b" value="bacs">
       <label for="pm_b">Bank transfer</label></p>
  </fieldset>
  <div class="payment_box" id="box" aria-label="Card details"><p>Card details</p></div>`;
  assert.deepEqual(html(CHECKOUT_SHELL(controlled)), []);
});

test('a saved card named only by a brand image is reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <div class="saved-cards">\n'
    + '    <p><input type="radio" name="wc-card-payment-token" id="t1" value="1">\n'
    + '       <label for="t1"><img src="/visa.svg" alt="Visa"></label></p>\n'
    + '  </div>',
  ));
  assert.deepEqual(tokens, ['saved-card-not-distinguishable@serious']);
});

test('a saved card list reports once per card and not once per wrapper', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <div class="saved-cards">\n'
    + '    <p class="saved-card"><input type="radio" name="wc-card-payment-token" id="t1" value="1">\n'
    + '       <label for="t1">Visa</label></p>\n'
    + '    <p class="saved-card"><input type="radio" name="wc-card-payment-token" id="t2" value="2">\n'
    + '       <label for="t2">Mastercard</label></p>\n'
    + '  </div>',
  ));
  assert.deepEqual(tokens, ['saved-card-not-distinguishable@serious']);
});

test('the terms checkbox with the terms text not associated is reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <p class="terms"><input type="checkbox" name="terms" id="terms">\n'
    + '    <span>I agree to the website terms and conditions and the privacy notice.</span></p>',
  ));
  assert.ok(tokens.includes('terms-checkbox-unlabelled@serious'));
});

test('the same checkbox wrapped in its label is fine', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <p class="terms"><label for="terms"><input type="checkbox" name="terms" id="terms">\n'
    + '    I agree to the website terms and conditions and the privacy notice.</label></p>',
  ));
  assert.deepEqual(tokens, []);
});

test('the terms checkbox described by the terms paragraph is accepted', () => {
  const tokens = html(CHECKOUT_SHELL(
    RADIOS + '\n'
    + '  <p id="terms_text">I agree to the website terms and conditions and the privacy notice.</p>\n'
    + '  <p class="terms"><label for="terms">I agree</label>\n'
    + '    <input type="checkbox" name="terms" id="terms" aria-describedby="terms_text"></p>',
  ));
  assert.deepEqual(tokens, []);
});

test('a place order control that is not a submit inside a form with an action is reported', () => {
  const tokens = html(CHECKOUT_SHELL(RADIOS + '\n  <a href="#" class="place-order">Place order</a>'));
  assert.ok(tokens.includes('payment-form-js-only@moderate'));
});

test('a submit button inside a form with an action is fine', () => {
  assert.deepEqual(html(CHECKOUT_SHELL(RADIOS)), []);
});
