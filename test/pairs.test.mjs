import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAIRS, BY_SLUG } from '../patterns/manifest.mjs';
import { BY_ID, AREAS } from '../src/catalogue.mjs';
import { tokensForFile, read } from './corpus.mjs';

test('there are pairs to check', () => {
  assert.ok(PAIRS.length >= 15, 'expected at least fifteen pairs, found ' + PAIRS.length);
});

test('every pair has a unique slug and the lookup map agrees', () => {
  const slugs = PAIRS.map((pair) => pair.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(BY_SLUG.size, PAIRS.length);
});

test('every pair names an area that exists', () => {
  const areas = new Set(AREAS.map((area) => area.id));
  for (const pair of PAIRS) assert.ok(areas.has(pair.area), pair.slug + ' names area ' + pair.area);
});

test('every pair declares at least one finding, because a pair with none is not a pair', () => {
  for (const pair of PAIRS) {
    assert.ok(pair.findings.length > 0, pair.slug + ' declares no findings');
  }
});

test('every declared token names a catalogued finding and a severity it declares', () => {
  for (const pair of PAIRS) {
    for (const token of [...pair.findings, ...pair.residual]) {
      const [id, severity] = token.split('@');
      const entry = BY_ID.get(id);
      assert.ok(entry, pair.slug + ' names an id that is not catalogued: ' + id);
      assert.ok(entry.severities.includes(severity),
        pair.slug + ' names ' + token + ', which the catalogue does not declare');
    }
  }
});

for (const pair of PAIRS) {
  test('the failing example in ' + pair.slug + ' produces exactly what it declares', () => {
    const produced = tokensForFile(pair.before);
    assert.deepEqual(produced, [...pair.findings].sort(),
      pair.before + ' produced [' + produced.join(' ') + ']');
  });

  test('the corrected example in ' + pair.slug + ' produces exactly its declared residual', () => {
    const produced = tokensForFile(pair.after);
    assert.deepEqual(produced, [...pair.residual].sort(),
      pair.after + ' produced [' + produced.join(' ') + ']');
  });

  test('the corrected example in ' + pair.slug + ' is not simply the failing one again', () => {
    assert.notEqual(read(pair.before), read(pair.after));
  });

  test('the correction in ' + pair.slug + ' clears every finding it does not declare as residual', () => {
    const cleared = pair.findings.filter((token) => !pair.residual.includes(token));
    assert.ok(cleared.length > 0, pair.slug + ' clears nothing at all');
  });
}

test('every pair asserts its sets as exact sets rather than by containment', () => {
  // This is a claim about how the suite above is written, and it is here
  // because inclusion is the mistake that hides every false positive a corpus
  // triggers. The assertions above use deepEqual against a sorted array; a
  // future edit to includes() would make them pass while checking nothing.
  const source = read('test/pairs.test.mjs');
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.match(code, /assert\.deepEqual\(produced, \[\.\.\.pair\.findings\]\.sort\(\)/);
  assert.match(code, /assert\.deepEqual\(produced, \[\.\.\.pair\.residual\]\.sort\(\)/);
  assert.equal(/produced\.includes\(/.test(code), false,
    'a pair assertion is using containment, which hides every undeclared finding');
});
