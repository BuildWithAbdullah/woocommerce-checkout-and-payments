import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseElements } from '../src/html.mjs';
import {
  isFormControl, controlType, formControls, ancestorOfTag, labelsFor,
  labelledByText, accessibleName, isRequiredProgrammatically,
  looksRequiredOnScreen, classList, hasClassMatching, describedByIds,
  isLiveRegion, isFocusable,
} from '../src/a11y.mjs';

const parse = (source) => ({ source, elements: parseElements(source) });

test('a text input, a select and a textarea are form controls', () => {
  const { elements } = parse('<input><select></select><textarea></textarea>');
  assert.deepEqual(formControls(elements).map((el) => el.tag), ['input', 'select', 'textarea']);
});

test('a hidden input, a submit and a button are not fields to be labelled', () => {
  const { elements } = parse('<input type="hidden"><input type="submit"><input type="button"><input type="image">');
  assert.deepEqual(formControls(elements), []);
});

test('an input with no type is treated as text', () => {
  const { elements } = parse('<input name="a">');
  assert.equal(controlType(elements[0]), 'text');
  assert.equal(isFormControl(elements[0]), true);
});

test('a type is read case insensitively', () => {
  const { elements } = parse('<input type="HIDDEN">');
  assert.equal(isFormControl(elements[0]), false);
});

test('a label with a for attribute names the field with that id', () => {
  const { source, elements } = parse('<label for="a">Town</label><input id="a">');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, 'Town');
  assert.equal(accessibleName(source, elements, input).from, 'label');
});

test('a label wrapping a field names it without a for attribute', () => {
  const { source, elements } = parse('<label>Town <input id="a"></label>');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, 'Town');
});

test('an aria label beats a label element, because the specification says so', () => {
  const { source, elements } = parse('<label for="a">Town</label><input id="a" aria-label="City">');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, 'City');
  assert.equal(accessibleName(source, elements, input).from, 'aria-label');
});

test('aria labelledby beats a label element and joins several ids in order', () => {
  const source = '<span id="x">Billing</span><span id="y">postcode</span>'
    + '<label for="a">Town</label><input id="a" aria-labelledby="x y">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, 'Billing postcode');
});

test('aria labelledby pointing at nothing leaves the field with no name from it', () => {
  const source = '<input id="a" aria-labelledby="missing">';
  const { elements } = parse(source);
  assert.equal(labelledByText(source, elements, elements[0]), null);
  assert.equal(accessibleName(source, elements, elements[0]).name, null);
});

test('an empty aria label does not count as a name', () => {
  const source = '<input id="a" aria-label="   ">';
  const { elements } = parse(source);
  assert.equal(accessibleName(source, elements, elements[0]).name, null);
});

test('a label whose for attribute has a typo names nothing', () => {
  const source = '<label for="aa">Town</label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.deepEqual(labelsFor(source, elements, input), []);
  assert.equal(accessibleName(source, elements, input).name, null);
});

test('an empty label element does not count as a name', () => {
  const source = '<label for="a"></label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, null);
});

test('a placeholder is never a name', () => {
  const source = '<input id="a" placeholder="Town or city">';
  const { elements } = parse(source);
  assert.equal(accessibleName(source, elements, elements[0]).name, null);
});

test('a title attribute is deliberately not consulted', () => {
  const source = '<input id="a" title="Town">';
  const { elements } = parse(source);
  assert.equal(accessibleName(source, elements, elements[0]).name, null);
});

test('required is read from the attribute or from aria required set to true', () => {
  const { elements } = parse('<input required><input aria-required="true"><input aria-required="false"><input>');
  assert.deepEqual(elements.map(isRequiredProgrammatically), [true, true, false, false]);
});

test('aria required is read case insensitively', () => {
  const { elements } = parse('<input aria-required="TRUE">');
  assert.equal(isRequiredProgrammatically(elements[0]), true);
});

test('an asterisk in the label text counts as a marker on screen', () => {
  const source = '<label for="a">Town <abbr class="required">*</abbr></label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(looksRequiredOnScreen(source, elements, input), true);
});

test('the word required in the label text counts as a marker on screen', () => {
  const source = '<label for="a">Town (required)</label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(looksRequiredOnScreen(source, elements, input), true);
});

test('a marker outside the label is not seen, which is a limit and not a bug', () => {
  const source = '<label for="a">Town</label><span class="required">*</span><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(looksRequiredOnScreen(source, elements, input), false);
});

test('an ancestor is found by tag from the inside out', () => {
  const { elements } = parse('<form><fieldset><label><input></label></fieldset></form>');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(ancestorOfTag(elements, input, 'form').tag, 'form');
  assert.equal(ancestorOfTag(elements, input, 'label').tag, 'label');
  assert.equal(ancestorOfTag(elements, input, 'table'), null);
});

test('the class list is lowercased and split on whitespace', () => {
  const { elements } = parse('<div class="Form-Row  REQUIRED">');
  assert.deepEqual(classList(elements[0]), ['form-row', 'required']);
  assert.equal(hasClassMatching(elements[0], /^required$/), true);
  assert.equal(hasClassMatching(elements[0], /^absent$/), false);
});

test('described by ids are split into a list', () => {
  const { elements } = parse('<input aria-describedby="a b  c">');
  assert.deepEqual(describedByIds(elements[0]), ['a', 'b', 'c']);
  assert.deepEqual(describedByIds(parseElements('<input>')[0]), []);
});

test('a live region is one with an alert or status role or a polite or assertive aria live', () => {
  const { elements } = parse('<div role="alert"></div><div role="status"></div>'
    + '<div aria-live="polite"></div><div aria-live="assertive"></div>'
    + '<div aria-live="off"></div><div></div>');
  assert.deepEqual(elements.map(isLiveRegion), [true, true, true, true, false, false]);
});

test('focusable means a natural focus target or any tabindex, including a negative one', () => {
  const { elements } = parse('<a></a><button></button><div></div><div tabindex="-1"></div><div tabindex="0"></div>');
  assert.deepEqual(elements.map(isFocusable), [true, true, false, true, true]);
});

test('an image contributes its alternative text to the name of the label around it', () => {
  const source = '<label for="a"><img src="/visa.svg" alt="Visa"> ending 4242</label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, 'Visa ending 4242');
});

test('an image with an empty alt is decorative and contributes nothing', () => {
  const source = '<label for="a"><img src="/visa.svg" alt=""></label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, null);
});

test('an image with no alt at all contributes nothing', () => {
  const source = '<label for="a"><img src="/visa.svg"></label><input id="a">';
  const { elements } = parse(source);
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(accessibleName(source, elements, input).name, null);
});
