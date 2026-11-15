import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITS, LIMIT_KINDS, BY_ID as LIMIT_BY_ID } from '../src/limits.mjs';
import { BY_ID } from '../src/catalogue.mjs';
import { tokensForFile, read } from './corpus.mjs';

test('the limits are declared and each one has a unique id', () => {
  assert.ok(LIMITS.length >= 10, 'expected at least ten declared limits');
  const ids = LIMITS.map((limit) => limit.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(LIMIT_BY_ID.size, LIMITS.length);
});

test('every limit is of a declared kind, and both kinds are represented', () => {
  for (const limit of LIMITS) {
    assert.ok(LIMIT_KINDS.includes(limit.kind), limit.id + ' is of kind ' + limit.kind);
  }
  for (const kind of LIMIT_KINDS) {
    assert.ok(LIMITS.some((limit) => limit.kind === kind), 'no limit of kind ' + kind);
  }
});

test('every limit says what it is in a headline and explains itself at length', () => {
  for (const limit of LIMITS) {
    assert.ok(limit.headline.length > 20, limit.id + ' has no headline worth reading');
    assert.ok(limit.prose.length > 80, limit.id + ' is not explained');
  }
});

test('every token a limit declares is catalogued at a declared severity', () => {
  for (const limit of LIMITS) {
    for (const token of [...limit.blindFindings, ...limit.contrastFindings]) {
      const [id, severity] = token.split('@');
      const entry = BY_ID.get(id);
      assert.ok(entry, limit.id + ' names an uncatalogued id: ' + id);
      assert.ok(entry.severities.includes(severity), limit.id + ' names undeclared ' + token);
    }
  }
});

for (const limit of LIMITS) {
  test('the blind example for ' + limit.id + ' produces exactly what is declared for it', () => {
    const produced = tokensForFile(limit.blind);
    assert.deepEqual(produced, [...limit.blindFindings].sort(),
      limit.blind + ' produced [' + produced.join(' ') + ']');
  });

  test('the contrast example for ' + limit.id + ' produces exactly what is declared for it', () => {
    const produced = tokensForFile(limit.contrast);
    assert.deepEqual(produced, [...limit.contrastFindings].sort(),
      limit.contrast + ' produced [' + produced.join(' ') + ']');
  });

  test('the blind and contrast examples for ' + limit.id + ' are different files', () => {
    assert.notEqual(limit.blind, limit.contrast);
    assert.notEqual(read(limit.blind), read(limit.contrast));
  });

  test('the two examples for ' + limit.id + ' disagree, which is what makes it a limit', () => {
    const blind = [...limit.blindFindings].sort().join(' ');
    const contrast = [...limit.contrastFindings].sort().join(' ');
    assert.notEqual(blind, contrast,
      limit.id + ' has the same result both ways, so it demonstrates nothing');
  });
}

test('a limit that hides a problem reports nothing for the blind case and something for the contrast', () => {
  for (const limit of LIMITS.filter((l) => l.kind === 'hides')) {
    assert.deepEqual(limit.blindFindings, [],
      limit.id + ' is declared as hiding a problem and yet reports ' + limit.blindFindings.join(' '));
    assert.ok(limit.contrastFindings.length > 0,
      limit.id + ' has a contrast case that reports nothing, so it proves nothing');
  }
});

test('a limit that manufactures a finding reports something for the blind case and nothing for the contrast', () => {
  for (const limit of LIMITS.filter((l) => l.kind === 'manufactures')) {
    assert.ok(limit.blindFindings.length > 0,
      limit.id + ' is declared as manufacturing a finding and reports none');
    assert.deepEqual(limit.contrastFindings, [],
      limit.id + ' has a contrast case that is not clean, so the comparison says nothing');
  }
});

test('every limit example lives under the limits directory', () => {
  for (const limit of LIMITS) {
    assert.match(limit.blind, /^limits\//);
    assert.match(limit.contrast, /^limits\//);
  }
});
