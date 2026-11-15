import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATALOGUE, AREAS, SEVERITIES, SEVERITY_RANK, BY_ID, entry, declaredSeverities, byArea, exitCodeFor, USAGE_EXIT } from '../src/catalogue.mjs';
import { PAIRS } from '../patterns/manifest.mjs';
import { FIXTURES } from '../fixtures/manifest.mjs';
import { LIMITS } from '../src/limits.mjs';
import { tokensForFile } from './corpus.mjs';

function everyTokenProduced() {
  const seen = new Set();
  const files = [];
  for (const pair of PAIRS) files.push(pair.before, pair.after);
  for (const fixture of FIXTURES) files.push(fixture.file);
  for (const limit of LIMITS) files.push(limit.blind, limit.contrast);
  for (const file of files) for (const token of tokensForFile(file)) seen.add(token);
  return seen;
}

const PRODUCED = everyTokenProduced();

test('every finding id is unique', () => {
  const ids = CATALOGUE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(BY_ID.size, CATALOGUE.length);
});

test('every finding id is lower case with single hyphens', () => {
  for (const e of CATALOGUE) {
    assert.match(e.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, e.id + ' is not a plain slug');
  }
});

test('every finding names an area that exists, and every area has findings', () => {
  const areas = new Set(AREAS.map((a) => a.id));
  for (const e of CATALOGUE) assert.ok(areas.has(e.area), e.id + ' names area ' + e.area);
  for (const area of AREAS) {
    assert.ok(byArea(area.id).length > 0, area.id + ' has no findings');
  }
});

test('every area id is unique and has a title', () => {
  const ids = AREAS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const area of AREAS) assert.ok(area.title.length > 10, area.id + ' has no title');
});

test('every finding declares at least one severity, all of them known and in rank order', () => {
  for (const e of CATALOGUE) {
    assert.ok(e.severities.length >= 1, e.id + ' declares no severity');
    assert.equal(new Set(e.severities).size, e.severities.length, e.id + ' repeats a severity');
    for (const severity of e.severities) {
      assert.ok(SEVERITIES.includes(severity), e.id + ' declares unknown severity ' + severity);
    }
    const ranks = e.severities.map((s) => SEVERITY_RANK[s]);
    const descending = [...ranks].sort((a, b) => b - a);
    assert.deepEqual(ranks, descending, e.id + ' lists its severities out of order');
  }
});

test('every finding states the reason it exists and what to do about it', () => {
  for (const e of CATALOGUE) {
    assert.ok(e.title.length > 40, e.id + ' has a title too short to be a reason');
    assert.equal(e.title.endsWith('.'), false, e.id + ' ends its title with a full stop');
    assert.ok(e.remedy.length > 20, e.id + ' has no remedy');
    assert.ok(e.remedy.endsWith('.'), e.id + ' has a remedy that is not a sentence');
  }
});

test('every catalogued finding is produced by something in this repository', () => {
  const producedIds = new Set([...PRODUCED].map((token) => token.split('@')[0]));
  const unreached = CATALOGUE.filter((e) => !producedIds.has(e.id)).map((e) => e.id);
  assert.deepEqual(unreached, [], 'findings nothing reaches: ' + unreached.join(', '));
});

test('every severity a run produces is one the catalogue declares', () => {
  const undeclared = [];
  for (const token of PRODUCED) {
    const [id, severity] = token.split('@');
    const found = BY_ID.get(id);
    if (!found || !found.severities.includes(severity)) undeclared.push(token);
  }
  assert.deepEqual(undeclared.sort(), [], 'produced but not declared: ' + undeclared.join(', '));
});

test('every severity the catalogue declares is produced by something in this repository', () => {
  const unproduced = [];
  for (const e of CATALOGUE) {
    for (const severity of e.severities) {
      if (!PRODUCED.has(e.id + '@' + severity)) unproduced.push(e.id + '@' + severity);
    }
  }
  assert.deepEqual(unproduced.sort(), [],
    'declared but never produced: ' + unproduced.join(', '));
});

test('the second direction is the one that does the work, so it is checked on a fake entry too', () => {
  // A finding that declares a severity nothing produces must be detectable.
  // This drives the same comparison over an invented entry to prove the
  // assertion above would fail rather than pass vacuously.
  const invented = { id: 'invented-finding', severities: ['minor', 'critical'] };
  const unproduced = invented.severities.filter((s) => !PRODUCED.has(invented.id + '@' + s));
  assert.deepEqual(unproduced, ['minor', 'critical']);
});

test('the finding that varies by severity really does vary in the corpus', () => {
  const varying = CATALOGUE.filter((e) => e.severities.length > 1);
  assert.ok(varying.length >= 4, 'expected several findings that vary by severity');
  for (const e of varying) {
    const seen = e.severities.filter((s) => PRODUCED.has(e.id + '@' + s));
    assert.deepEqual(seen, e.severities, e.id + ' does not reach all of its severities');
  }
});

test('the lookup helpers agree with the catalogue', () => {
  const first = CATALOGUE[0];
  assert.equal(entry(first.id), first);
  assert.deepEqual(declaredSeverities(first.id), first.severities);
  assert.notEqual(declaredSeverities(first.id), first.severities, 'the helper hands back its own array');
  assert.throws(() => entry('not-a-finding'), /unknown finding id/);
});

test('the exit code is the worst severity present', () => {
  assert.equal(exitCodeFor([]), 0);
  assert.equal(exitCodeFor(['minor']), 1);
  assert.equal(exitCodeFor(['moderate']), 1);
  assert.equal(exitCodeFor(['serious']), 2);
  assert.equal(exitCodeFor(['critical']), 3);
  assert.equal(exitCodeFor(['minor', 'critical', 'moderate']), 3);
  assert.equal(exitCodeFor(['minor', 'serious']), 2);
  assert.equal(USAGE_EXIT, 64);
});

test('the severity ranks are distinct and ordered the way the names suggest', () => {
  const ranks = SEVERITIES.map((s) => SEVERITY_RANK[s]);
  assert.deepEqual(ranks, [1, 2, 3, 4]);
});
