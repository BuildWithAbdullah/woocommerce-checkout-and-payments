import { test } from 'node:test';
import assert from 'node:assert/strict';

import { html, CHECKOUT_SHELL } from './support.mjs';

test('the shell every case is built on produces nothing by itself', () => {
  assert.deepEqual(html(CHECKOUT_SHELL('  <p>Nothing to see.</p>')), []);
});

test('a field with no name at all is reported, and the same field labelled is not', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <input type="text" id="x" name="x">')),
    ['field-without-label@serious'],
  );
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Thing</label><input type="text" id="x" name="x">')),
    [],
  );
});

test('a field whose only name is a placeholder is a different finding from one with no name', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <input type="text" id="x" name="x" placeholder="Thing">')),
    ['placeholder-as-label@serious'],
  );
});

test('a placeholder beside a real label is fine', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Thing</label><input id="x" name="x" placeholder="e.g. SW1A 1AA">')),
    [],
  );
});

test('a label pointing at an id that is not on the page is reported', () => {
  const tokens = html(CHECKOUT_SHELL('  <label for="typo">Thing</label><input type="text" id="x" name="x">'));
  assert.ok(tokens.includes('label-not-associated@serious'));
});

test('a known address field with no autofill token is moderate', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="billing_city">Town</label><input id="billing_city" name="billing_city">')),
    ['autocomplete-missing@moderate'],
  );
});

test('a card field with no autofill token is serious, because the alternative is typing a card number', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="cc">Card number</label><input id="cc" name="card_number">')),
    ['autocomplete-missing@serious'],
  );
});

test('a field whose purpose is not in the known set is not asked for a token', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="gift">Gift message</label><input id="gift" name="gift_message">')),
    [],
  );
});

test('a wrong autofill token is reported, and a section prefix in front of the right one is not', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="p">Postcode</label><input id="p" name="billing_postcode" autocomplete="address-level2">')),
    ['autocomplete-token-wrong@moderate'],
  );
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="p">Postcode</label><input id="p" name="billing_postcode" autocomplete="billing postal-code">')),
    [],
  );
});

test('autocomplete set to off is a deliberate refusal and is left alone', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="p">Postcode</label><input id="p" name="billing_postcode" autocomplete="off">')),
    [],
  );
});

test('a field required on screen and not in the markup is reported', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Thing <abbr class="required">*</abbr></label><input id="x" name="x">')),
    ['required-not-programmatic@serious'],
  );
});

test('the same field with required, or with aria required, is fine', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Thing <abbr class="required">*</abbr></label><input id="x" name="x" required>')),
    [],
  );
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Thing <abbr class="required">*</abbr></label><input id="x" name="x" aria-required="true">')),
    [],
  );
});

test('a checkbox with an asterisk in its label is not asked for a required attribute', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <label for="x">Agree <abbr class="required">*</abbr></label><input type="checkbox" id="x" name="x">')),
    [],
  );
});

test('an error message no field points at is reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">Thing</label><input id="x" name="x">\n'
    + '  <span class="field-error" id="x_error">Required.</span>',
  ));
  assert.deepEqual(tokens, ['error-not-associated@serious']);
});

test('an error message with no id at all cannot be pointed at, so it is reported too', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">Thing</label><input id="x" name="x" aria-invalid="true">\n'
    + '  <span class="field-error">Required.</span>',
  ));
  assert.deepEqual(tokens, ['error-not-associated@serious']);
});

test('a field that describes an error and is not marked invalid is reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">Thing</label><input id="x" name="x" aria-describedby="x_error">\n'
    + '  <span class="field-error" id="x_error">Required.</span>',
  ));
  assert.deepEqual(tokens, ['field-invalid-not-marked@serious']);
});

test('associated, marked invalid, and the whole arrangement is clean', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">Thing</label><input id="x" name="x" aria-describedby="x_error" aria-invalid="true">\n'
    + '  <span class="field-error" id="x_error">Required.</span>',
  ));
  assert.deepEqual(tokens, []);
});

test('two inline messages and no summary is reported once', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">One</label><input id="x" name="x" aria-describedby="x_e" aria-invalid="true">\n'
    + '  <span class="field-error" id="x_e">Required.</span>\n'
    + '  <label for="y">Two</label><input id="y" name="y" aria-describedby="y_e" aria-invalid="true">\n'
    + '  <span class="field-error" id="y_e">Required.</span>',
  ));
  assert.deepEqual(tokens, ['error-summary-missing@moderate']);
});

test('one inline message does not demand a summary', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="x">One</label><input id="x" name="x" aria-describedby="x_e" aria-invalid="true">\n'
    + '  <span class="field-error" id="x_e">Required.</span>',
  ));
  assert.deepEqual(tokens, []);
});

test('a summary that can be neither focused nor heard is reported', () => {
  const tokens = html(CHECKOUT_SHELL('  <div class="woocommerce-error"><ul><li>Required.</li></ul></div>'));
  assert.deepEqual(tokens, ['error-summary-not-focusable@serious']);
});

test('a summary with a tabindex, or with an alert role, or with aria live, is accepted', () => {
  for (const extra of ['tabindex="-1"', 'role="alert"', 'aria-live="polite"']) {
    assert.deepEqual(
      html(CHECKOUT_SHELL('  <div class="woocommerce-error" ' + extra + '><ul><li>Required.</li></ul></div>')),
      [],
      extra,
    );
  }
});

test('an empty summary container is not a summary', () => {
  assert.deepEqual(html(CHECKOUT_SHELL('  <div class="woocommerce-error"></div>')), []);
});

test('a fieldset with no legend is reported, and one with a legend is not', () => {
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <fieldset><label for="x">Thing</label><input id="x" name="x"></fieldset>')),
    ['fieldset-missing-legend@moderate'],
  );
  assert.deepEqual(
    html(CHECKOUT_SHELL('  <fieldset><legend>Group</legend><label for="x">Thing</label><input id="x" name="x"></fieldset>')),
    [],
  );
});

test('a legend belonging to a nested fieldset does not count for the outer one', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <fieldset><fieldset><legend>Inner</legend><label for="x">Thing</label><input id="x" name="x"></fieldset></fieldset>',
  ));
  assert.deepEqual(tokens, ['fieldset-missing-legend@moderate']);
});

test('billing and shipping fields in one flat group are reported', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="b">Billing town</label><input id="b" name="billing_city" autocomplete="address-level2">\n'
    + '  <label for="s">Shipping town</label><input id="s" name="shipping_city" autocomplete="address-level2">',
  ));
  assert.deepEqual(tokens, ['address-fields-ungrouped@minor']);
});

test('a role of group is enough to count as grouping', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <div role="group" aria-label="Billing"><label for="b">Billing town</label>'
    + '<input id="b" name="billing_city" autocomplete="address-level2"></div>\n'
    + '  <div role="group" aria-label="Shipping"><label for="s">Shipping town</label>'
    + '<input id="s" name="shipping_city" autocomplete="address-level2"></div>',
  ));
  assert.deepEqual(tokens, []);
});

test('billing fields with no shipping fields are not asked to be grouped', () => {
  const tokens = html(CHECKOUT_SHELL(
    '  <label for="b">Billing town</label><input id="b" name="billing_city" autocomplete="address-level2">',
  ));
  assert.deepEqual(tokens, []);
});
