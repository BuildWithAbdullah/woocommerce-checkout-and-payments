import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kindFor, isReadableKind, makeDoc, checkDoc, checkAll, summarise, tokensOf,
  renderText, renderJson, CHECKERS,
} from '../src/run.mjs';
import { CATALOGUE, AREAS } from '../src/catalogue.mjs';

test('the kind of a file comes from its extension', () => {
  assert.equal(kindFor('a.html'), 'html');
  assert.equal(kindFor('a.htm'), 'html');
  assert.equal(kindFor('a.PHP'), 'php');
  assert.equal(kindFor('a.js'), 'js');
  assert.equal(kindFor('a.mjs'), 'js');
  assert.equal(kindFor('a.json'), 'config');
  assert.equal(kindFor('a.conf'), 'conf');
  assert.equal(kindFor('.htaccess'), 'conf');
});

test('a file with no extension, or one nothing reads, has no kind', () => {
  assert.equal(kindFor('Makefile'), null);
  assert.equal(kindFor('a.txt'), null);
  assert.equal(isReadableKind('a.txt'), false);
  assert.equal(isReadableKind('a.php'), true);
});

test('making a document for an unreadable kind throws rather than guessing', () => {
  assert.throws(() => makeDoc('a.txt', 'x'), /no checker reads/);
});

test('a markup document is parsed once and the elements come with it', () => {
  const doc = makeDoc('a.html', '<div><input></div>');
  assert.equal(doc.kind, 'html');
  assert.equal(doc.elements.length, 2);
});

test('a PHP document is not parsed as markup', () => {
  const doc = makeDoc('a.php', '<?php $a = 1;');
  assert.equal(doc.kind, 'php');
  assert.equal(doc.elements, undefined);
});

test('every checker declares an area that exists and at least one kind it reads', () => {
  const areas = new Set(AREAS.map((area) => area.id));
  for (const checker of CHECKERS) {
    assert.ok(areas.has(checker.area), checker.area + ' is not an area');
    assert.ok(Array.isArray(checker.kinds) && checker.kinds.length > 0, checker.area + ' reads nothing');
    assert.equal(typeof checker.check, 'function', checker.area + ' has no check');
  }
});

test('there is one checker per area and no area is served twice', () => {
  const served = CHECKERS.map((checker) => checker.area);
  assert.equal(new Set(served).size, served.length);
  assert.deepEqual([...served].sort(), AREAS.map((area) => area.id).sort());
});

test('a finding comes back with its catalogue title and remedy attached', () => {
  const [finding] = checkDoc(makeDoc('a.php', "<?php\n$r = $this->client->charge( $t );\n"));
  const entry = CATALOGUE.find((e) => e.id === finding.id);
  assert.equal(finding.title, entry.title);
  assert.equal(finding.remedy, entry.remedy);
  assert.equal(finding.area, entry.area);
});

test('the same finding at the same line is reported once', () => {
  const findings = checkDoc(makeDoc('a.html', '<form class="woocommerce-checkout" action="/c/" method="post">'
    + '<input id="x" name="x"><button type="submit">Place order</button></form>'));
  const keys = findings.map((f) => f.id + '#' + f.line);
  assert.equal(new Set(keys).size, keys.length);
});

test('findings are ordered by path, then by severity, then by line', () => {
  const docs = [
    makeDoc('b.php', "<?php\n$r = $this->client->charge( $t );\n"),
    makeDoc('a.php', '<?php\n$t = floatval( $price );\n$u = floor( $total );\n'),
  ];
  const findings = checkAll(docs);
  assert.deepEqual(findings.map((f) => f.path), ['a.php', 'a.php', 'b.php']);
  assert.deepEqual(findings.slice(0, 2).map((f) => f.severity), ['serious', 'minor']);
});

test('a summary counts by severity and carries the exit code', () => {
  const findings = checkAll([
    makeDoc('a.php', "<?php\n$r = $this->client->charge( $t );\n"),
    makeDoc('b.php', '<?php\n$u = floor( $total );\n'),
  ]);
  const summary = summarise(findings);
  assert.equal(summary.total, 2);
  assert.equal(summary.counts.critical, 1);
  assert.equal(summary.counts.minor, 1);
  assert.equal(summary.exitCode, 3);
});

test('a summary of nothing is zero on every count', () => {
  const summary = summarise([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.exitCode, 0);
  assert.deepEqual(summary.counts, { minor: 0, moderate: 0, serious: 0, critical: 0 });
});

test('tokens are a sorted set of id and severity pairs', () => {
  const findings = checkAll([makeDoc('a.php', '<?php\n$t = floatval( $a );\n$u = floatval( $b );\n')]);
  assert.deepEqual(tokensOf(findings), ['money-held-as-float@serious']);
});

test('the text renderer prints the path once and every finding under it', () => {
  const findings = checkAll([makeDoc('a.php', '<?php\n$t = floatval( $a );\n$u = floor( $total );\n')]);
  const text = renderText(findings, summarise(findings));
  assert.equal((text.match(/^a\.php$/gm) || []).length, 1);
  assert.match(text, /money-held-as-float/);
  assert.match(text, /total-rounded-toward-zero/);
  assert.match(text, /2 findings: 0 critical, 1 serious, 0 moderate, 1 minor/);
});

test('the text renderer says so plainly when there is nothing', () => {
  assert.equal(renderText([], summarise([])), 'No findings.\n');
});

test('the JSON renderer produces an object a machine can read and ends with a newline', () => {
  const findings = checkAll([makeDoc('a.php', '<?php\n$t = floatval( $a );\n')]);
  const json = renderJson(findings, summarise(findings));
  assert.equal(json.endsWith('\n'), true);
  const parsed = JSON.parse(json);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.findings[0].line, 2);
  assert.equal(parsed.counts.serious, 1);
});

test('the JSON renderer does not leak the catalogue prose into every finding', () => {
  const findings = checkAll([makeDoc('a.php', '<?php\n$t = floatval( $a );\n')]);
  const parsed = JSON.parse(renderJson(findings, summarise(findings)));
  assert.deepEqual(Object.keys(parsed.findings[0]).sort(),
    ['area', 'detail', 'id', 'line', 'path', 'severity']);
});

test('a checker emitting a severity its finding does not declare fails loudly', () => {
  // Driven through checkDoc with a checker list of one, so the guard is
  // exercised rather than assumed. The guard is what stops a severity table
  // from being decoration.
  const doc = makeDoc('a.php', '<?php\n$a = 1;\n');
  const original = CHECKERS.slice();
  CHECKERS.length = 0;
  CHECKERS.push({
    area: 'gateway-failures',
    kinds: ['php'],
    check: () => [{ id: 'card-data-in-log', severity: 'minor', line: 1, detail: '' }],
  });
  try {
    assert.throws(() => checkDoc(doc), /does not declare/);
  } finally {
    CHECKERS.length = 0;
    for (const checker of original) CHECKERS.push(checker);
  }
  assert.equal(CHECKERS.length, original.length);
});

test('a checker emitting an id that is not catalogued fails loudly', () => {
  const doc = makeDoc('a.php', '<?php\n$a = 1;\n');
  const original = CHECKERS.slice();
  CHECKERS.length = 0;
  CHECKERS.push({
    area: 'gateway-failures',
    kinds: ['php'],
    check: () => [{ id: 'not-a-real-finding', severity: 'minor', line: 1, detail: '' }],
  });
  try {
    assert.throws(() => checkDoc(doc), /unknown finding id/);
  } finally {
    CHECKERS.length = 0;
    for (const checker of original) CHECKERS.push(checker);
  }
});

test('a checker is only asked about the kinds it reads', () => {
  const asked = [];
  const original = CHECKERS.slice();
  CHECKERS.length = 0;
  CHECKERS.push({
    area: 'gateway-failures',
    kinds: ['php'],
    check: (doc) => { asked.push(doc.kind); return []; },
  });
  try {
    checkDoc(makeDoc('a.php', '<?php\n'));
    checkDoc(makeDoc('a.html', '<p></p>'));
    checkDoc(makeDoc('a.json', '{}'));
  } finally {
    CHECKERS.length = 0;
    for (const checker of original) CHECKERS.push(checker);
  }
  assert.deepEqual(asked, ['php']);
});
