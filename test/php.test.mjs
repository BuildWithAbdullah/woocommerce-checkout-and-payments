import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blankComments, codeLines, matchLines, hasLine, firstLine, codeText, enclosingLine,
} from '../src/php.mjs';

test('a line comment is blanked and the line it was on is still there', () => {
  const blanked = blankComments('$a = 1; // set a\n$b = 2;\n');
  const lines = blanked.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0].trim(), '$a = 1;');
  assert.equal(lines[1].trim(), '$b = 2;');
});

test('blanking keeps the source exactly as long as it was', () => {
  const source = '$a = 1; // a comment\n/* another */\n$b = 2;\n';
  assert.equal(blankComments(source).length, source.length);
});

test('a hash comment is blanked', () => {
  assert.equal(blankComments('$a = 1; # note').trim(), '$a = 1;');
});

test('a PHP attribute is not treated as a hash comment', () => {
  const blanked = blankComments('#[Attribute]\nfunction x() {}\n');
  assert.match(blanked, /Attribute/);
});

test('a block comment spanning lines keeps every one of its newlines', () => {
  const blanked = blankComments('/*\n one\n two\n*/\n$a = 1;\n');
  assert.equal(blanked.split('\n').length, 6);
  assert.equal(blanked.split('\n')[4].trim(), '$a = 1;');
});

test('two slashes inside a double quoted string are not a comment', () => {
  const blanked = blankComments("$url = 'https://example.test/a'; $b = 1;");
  assert.match(blanked, /example\.test/);
  assert.match(blanked, /\$b = 1;/);
});

test('a hash inside a string is not a comment', () => {
  const blanked = blankComments('$anchor = "#top"; $b = 1;');
  assert.match(blanked, /#top/);
  assert.match(blanked, /\$b = 1;/);
});

test('an escaped quote inside a string does not end the string', () => {
  const blanked = blankComments('$s = "a \\" // b"; $c = 1;');
  assert.match(blanked, /\$c = 1;/);
});

test('a heredoc body is left alone, including anything in it that looks like a comment', () => {
  const source = '$sql = <<<SQL\n-- not a php comment // nor this\nSQL;\n$a = 1;\n';
  const blanked = blankComments(source);
  assert.match(blanked, /not a php comment/);
  assert.match(blanked, /\$a = 1;/);
});

test('a nowdoc body is left alone too', () => {
  const source = "$t = <<<'TXT'\n// keep me\nTXT;\n$a = 1;\n";
  const blanked = blankComments(source);
  assert.match(blanked, /keep me/);
});

test('code lines are numbered from one', () => {
  const lines = codeLines('a\nb\nc');
  assert.deepEqual(lines.map((l) => l.no), [1, 2, 3]);
  assert.deepEqual(lines.map((l) => l.text), ['a', 'b', 'c']);
});

test('matching reports the line number of each hit', () => {
  const hits = matchLines('one\ntwo\nthree two\n', /two/);
  assert.deepEqual(hits.map((h) => h.no), [2, 3]);
});

test('matching never reads a commented out line', () => {
  const hits = matchLines('// wp_remote_post( $url );\nwp_remote_post( $url );\n', /wp_remote_post/);
  assert.deepEqual(hits.map((h) => h.no), [2]);
});

test('a global flag on the pattern does not make the matcher skip lines', () => {
  const hits = matchLines('a\na\na\n', /a/g);
  assert.equal(hits.length, 3);
});

test('a sticky flag on the pattern is stripped as well', () => {
  const hits = matchLines('xa\nxa\n', /a/y);
  assert.equal(hits.length, 2);
});

test('the matched groups come back with the hit', () => {
  const [hit] = matchLines("add_action( 'woocommerce_thankyou', 'x' );", /add_action\(\s*'([a-z_]+)'/);
  assert.equal(hit.match[1], 'woocommerce_thankyou');
});

test('has line and first line agree with the matcher', () => {
  const source = 'a\nb\nneedle\n';
  assert.equal(hasLine(source, /needle/), true);
  assert.equal(firstLine(source, /needle/), 3);
  assert.equal(hasLine(source, /absent/), false);
  assert.equal(firstLine(source, /absent/), null);
});

test('code text is the whole blanked source as one string', () => {
  const text = codeText('$a = 1; // gone\n$b = 2;\n');
  assert.equal(text.includes('gone'), false);
  assert.equal(text.includes('$b = 2;'), true);
});

test('the enclosing line looks backwards for the call a finding belongs to', () => {
  const source = 'wp_remote_post(\n  $url,\n  array()\n);\n';
  assert.equal(enclosingLine(source, 3, /wp_remote_post/), 1);
  assert.equal(enclosingLine(source, 3, /not_here/), null);
});

test('a pattern given as a string is accepted', () => {
  assert.equal(matchLines('abc\n', 'b').length, 1);
});

test('blanking an empty source returns an empty source', () => {
  assert.equal(blankComments(''), '');
  assert.deepEqual(codeLines(''), [{ no: 1, text: '' }]);
});

test('a trailing line comment with no newline after it is still blanked', () => {
  assert.equal(blankComments('$a = 1; // end').trim(), '$a = 1;');
});

test('an unterminated block comment blanks to the end of the file', () => {
  const blanked = blankComments('$a = 1;\n/* never closed\n$b = 2;\n');
  assert.equal(blanked.includes('$b = 2;'), false);
  assert.equal(blanked.includes('$a = 1;'), true);
});
