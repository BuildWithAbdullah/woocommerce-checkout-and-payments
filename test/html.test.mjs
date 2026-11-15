import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseElements, innerHtml, innerText, textOf, attr, hasAttr, tokens, byTag,
  idMap, decodeEntities,
} from '../src/html.mjs';

test('an element carries its tag, its attributes and the line it opened on', () => {
  const elements = parseElements('<div>\n  <input type="text" id="a">\n</div>\n');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(input.line, 2);
  assert.equal(attr(input, 'type'), 'text');
  assert.equal(attr(input, 'id'), 'a');
});

test('tag names and attribute names are lowercased, values are not', () => {
  const [el] = parseElements('<INPUT TYPE="Text" DATA-Thing="KeepMe">');
  assert.equal(el.tag, 'input');
  assert.equal(attr(el, 'type'), 'Text');
  assert.equal(attr(el, 'data-thing'), 'KeepMe');
});

test('an attribute may be double quoted, single quoted, unquoted or bare', () => {
  const [el] = parseElements('<input type=text id=\'b\' name="c" required>');
  assert.equal(attr(el, 'type'), 'text');
  assert.equal(attr(el, 'id'), 'b');
  assert.equal(attr(el, 'name'), 'c');
  assert.equal(attr(el, 'required'), '');
  assert.equal(hasAttr(el, 'required'), true);
});

test('a missing attribute reads as null, which is not the same as present and empty', () => {
  const [el] = parseElements('<input alt="">');
  assert.equal(attr(el, 'alt'), '');
  assert.equal(hasAttr(el, 'alt'), true);
  assert.equal(attr(el, 'title'), null);
  assert.equal(hasAttr(el, 'title'), false);
});

test('a greater than sign inside an attribute value does not end the tag', () => {
  const elements = parseElements('<input value="a > b"><span>after</span>');
  assert.equal(elements.length, 2);
  assert.equal(attr(elements[0], 'value'), 'a > b');
  assert.equal(elements[1].tag, 'span');
});

test('the first value of a repeated attribute is the one kept', () => {
  const [el] = parseElements('<input id="first" id="second">');
  assert.equal(attr(el, 'id'), 'first');
});

test('a comment is skipped whole and does not contribute elements', () => {
  const elements = parseElements('<!-- <input id="ghost"> -->\n<span></span>');
  assert.deepEqual(elements.map((el) => el.tag), ['span']);
});

test('a comment keeps the line count honest for what follows it', () => {
  const elements = parseElements('<!--\nthree\nlines\n-->\n<span></span>');
  assert.equal(elements[0].line, 5);
});

test('a doctype and a processing instruction are skipped', () => {
  const elements = parseElements('<!doctype html>\n<?php echo "x"; ?>\n<span></span>');
  assert.deepEqual(elements.map((el) => el.tag), ['span']);
  assert.equal(elements[0].line, 3);
});

test('markup written inside a script is not parsed as markup', () => {
  const elements = parseElements('<script>var s = "<input id=\'ghost\'>";</script><span></span>');
  assert.deepEqual(elements.map((el) => el.tag), ['script', 'span']);
});

test('markup written inside a style block is not parsed as markup', () => {
  const elements = parseElements('<style>a[href]::after { content: "<b>"; }</style><em></em>');
  assert.deepEqual(elements.map((el) => el.tag), ['style', 'em']);
});

test('a void element never becomes a parent', () => {
  const elements = parseElements('<p><br><span>x</span></p>');
  const span = elements.find((el) => el.tag === 'span');
  const paragraph = elements.find((el) => el.tag === 'p');
  assert.equal(span.parent, paragraph.index);
});

test('a self closing tag written with a slash never becomes a parent', () => {
  const elements = parseElements('<div><img src="a.png" /><span>x</span></div>');
  const span = elements.find((el) => el.tag === 'span');
  const div = elements.find((el) => el.tag === 'div');
  assert.equal(span.parent, div.index);
});

test('a list item closes the one before it, so a list is not nested inside its first item', () => {
  const elements = parseElements('<ul><li>one<li>two</ul>');
  const items = byTag(elements, 'li');
  assert.equal(items.length, 2);
  assert.equal(items[0].parent, items[1].parent);
});

test('a paragraph closes the one before it', () => {
  const elements = parseElements('<div><p>one<p>two</div>');
  const paragraphs = byTag(elements, 'p');
  assert.equal(paragraphs[0].parent, paragraphs[1].parent);
});

test('a table cell closes the previous cell and a row closes the previous row', () => {
  const elements = parseElements('<table><tr><td>a<td>b<tr><td>c</table>');
  const cells = byTag(elements, 'td');
  const rows = byTag(elements, 'tr');
  assert.equal(cells.length, 3);
  assert.equal(rows.length, 2);
  assert.equal(cells[0].parent, cells[1].parent);
  assert.notEqual(cells[1].parent, cells[2].parent);
});

test('an unmatched closing tag is ignored rather than throwing', () => {
  const elements = parseElements('<div>x</span></div><em>y</em>');
  assert.deepEqual(elements.map((el) => el.tag), ['div', 'em']);
});

test('a closing tag pops every element opened inside the one it closes', () => {
  const elements = parseElements('<div><span><em>x</div><b>y</b>');
  const bold = elements.find((el) => el.tag === 'b');
  assert.equal(bold.parent, null);
});

test('ancestors are recorded in order from the outside in', () => {
  const elements = parseElements('<form><fieldset><p><input></p></fieldset></form>');
  const input = elements.find((el) => el.tag === 'input');
  assert.deepEqual(input.ancestors.map((i) => elements[i].tag), ['form', 'fieldset', 'p']);
});

test('inner html is the source between the open tag and the close tag', () => {
  const source = '<label for="a">Name <abbr>*</abbr></label>';
  const [label] = parseElements(source);
  assert.equal(innerHtml(source, label), 'Name <abbr>*</abbr>');
});

test('inner text drops the tags and collapses the whitespace', () => {
  const source = '<label>  Town\n   or <b>city</b>  </label>';
  const [label] = parseElements(source);
  assert.equal(innerText(source, label), 'Town or city');
});

test('inner text of a label does not include a script written inside it', () => {
  const source = '<label>Name<script>var x = 1;</script></label>';
  const [label] = parseElements(source);
  assert.equal(innerText(source, label), 'Name');
});

test('text of a label decodes the named entities a checkout actually uses', () => {
  const source = '<label>First name&nbsp;&amp; last</label>';
  const [label] = parseElements(source);
  assert.equal(textOf(source, label), 'First name & last');
});

test('a numeric entity is decoded in decimal and in hex', () => {
  assert.equal(decodeEntities('&#65;&#x42;'), 'AB');
});

test('an entity that is not known is left exactly as it was written', () => {
  assert.equal(decodeEntities('&notanentity;'), '&notanentity;');
});

test('an out of range numeric entity is left alone rather than throwing', () => {
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;');
});

test('an unclosed element at the end of the document still has a close offset', () => {
  const source = '<div><span>x';
  const elements = parseElements(source);
  for (const el of elements) assert.equal(typeof el.close, 'number');
  assert.equal(innerText(source, elements[0]), 'x');
});

test('tokens splits on any run of whitespace and drops the empties', () => {
  assert.deepEqual(tokens('  a\n b   c '), ['a', 'b', 'c']);
  assert.deepEqual(tokens(''), []);
  assert.deepEqual(tokens(null), []);
});

test('the id map keeps the first element for a repeated id', () => {
  const elements = parseElements('<span id="a">1</span><span id="a">2</span>');
  const map = idMap(elements);
  assert.equal(map.get('a'), elements[0]);
});

test('an entity in an attribute value is decoded', () => {
  const [el] = parseElements('<input aria-label="Name &amp; address">');
  assert.equal(attr(el, 'aria-label'), 'Name & address');
});

test('a tag spread across several lines reports the line it opened on', () => {
  const elements = parseElements('<div>\n<input\n  type="text"\n  id="a">\n</div>');
  const input = elements.find((el) => el.tag === 'input');
  assert.equal(input.line, 2);
});

test('an element after a multi line tag reports the line it is actually on', () => {
  const elements = parseElements('<input\n  type="text">\n<span></span>');
  const span = elements.find((el) => el.tag === 'span');
  assert.equal(span.line, 3);
});

test('an empty document produces no elements', () => {
  assert.deepEqual(parseElements(''), []);
  assert.deepEqual(parseElements('just text'), []);
});
