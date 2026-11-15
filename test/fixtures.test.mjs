import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FIXTURES } from '../fixtures/manifest.mjs';
import { BY_ID, AREAS } from '../src/catalogue.mjs';
import { tokensForFile } from './corpus.mjs';

test('every fixture names an area that exists and a file under fixtures', () => {
  const areas = new Set(AREAS.map((area) => area.id));
  for (const fixture of FIXTURES) {
    assert.ok(areas.has(fixture.area), fixture.file + ' names area ' + fixture.area);
    assert.match(fixture.file, /^fixtures\//);
  }
});

test('every fixture is listed once', () => {
  const files = FIXTURES.map((fixture) => fixture.file);
  assert.equal(new Set(files).size, files.length);
});

test('every fixture declares at least one finding', () => {
  for (const fixture of FIXTURES) {
    assert.ok(fixture.findings.length > 0, fixture.file + ' declares nothing');
  }
});

test('every fixture token is catalogued at a severity the catalogue declares', () => {
  for (const fixture of FIXTURES) {
    for (const token of fixture.findings) {
      const [id, severity] = token.split('@');
      const entry = BY_ID.get(id);
      assert.ok(entry, fixture.file + ' names an uncatalogued id: ' + id);
      assert.ok(entry.severities.includes(severity), fixture.file + ' names undeclared ' + token);
    }
  }
});

for (const fixture of FIXTURES) {
  test('the fixture ' + fixture.file + ' produces exactly what it declares', () => {
    const produced = tokensForFile(fixture.file);
    assert.deepEqual(produced, [...fixture.findings].sort(),
      fixture.file + ' produced [' + produced.join(' ') + ']');
  });
}
