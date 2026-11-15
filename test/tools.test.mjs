import { test } from 'node:test';
import assert from 'node:assert/strict';

import { testFilesFromPackage } from '../tools/count-tests.mjs';
import { stripComments, measure, BUDGETS, check as checkEntry } from '../tools/entry-thin.mjs';
import { expectedExit, expectations } from '../tools/exit-codes.mjs';
import { tokensFromText, tokensFromJson } from '../tools/audit-verdicts.mjs';
import { render as renderCatalogueDoc, OUTPUT as CATALOGUE_DOC } from '../tools/catalogue-doc.mjs';
import { render as renderLimitsDoc, OUTPUT as LIMITS_DOC } from '../tools/limits-doc.mjs';
import { CATALOGUE } from '../src/catalogue.mjs';
import { LIMITS } from '../src/limits.mjs';
import { PAIRS } from '../patterns/manifest.mjs';
import { FIXTURES } from '../fixtures/manifest.mjs';
import { read } from './corpus.mjs';

test('the test file list comes out of the test script rather than a second copy of it', () => {
  const files = testFilesFromPackage(read('package.json'));
  assert.ok(files.length >= 10, 'expected the suite to be several files, found ' + files.length);
  for (const file of files) assert.match(file, /^test\/[a-z0-9-]+\.test\.mjs$/);
  assert.equal(new Set(files).size, files.length);
});

test('every file the test script names exists and every test file is named', () => {
  const named = testFilesFromPackage(read('package.json'));
  for (const file of named) assert.ok(read(file).length > 0, file + ' is empty or missing');
});

test('a reporter flag in the test script is not mistaken for a file', () => {
  const files = testFilesFromPackage(JSON.stringify({
    scripts: { test: 'node --test --test-reporter=spec test/a.test.mjs test/b.test.mjs' },
  }));
  assert.deepEqual(files, ['test/a.test.mjs', 'test/b.test.mjs']);
});

test('comments are dropped before the entry point is measured', () => {
  const source = '// if ( a ) {}\nconst a = 1;\n/* if ( b ) {} */\n';
  assert.equal(stripComments(source).includes('if'), false);
  assert.equal(measure(source).branches, 0);
  assert.equal(measure(source).lines, 1);
});

test('the measure counts the branch constructs a decision would use', () => {
  const found = measure('if (a) { b(); } else { c(); }\nfor (;;) {}\nwhile (x) {}\n'
    + 'try { d(); } catch { e(); }\nconst y = a ? b : c;\nconst z = a && b || c;\n');
  assert.ok(found.branches >= 8, 'counted only ' + found.branches);
});

test('the entry point is inside its budget, and the budget has no headroom on branches', () => {
  const result = checkEntry('', read);
  assert.deepEqual(result.failures, []);
  for (const row of result.measured) {
    assert.equal(row.branches, row.budget.branches,
      row.file + ' has ' + row.branches + ' branches against a budget of ' + row.budget.branches
      + '; the budget is meant to sit exactly on the real figure');
  }
});

test('the budget names the entry point this package installs', () => {
  const pkg = JSON.parse(read('package.json'));
  const binaries = Object.values(pkg.bin).map((p) => p.replace(/^\.\//, ''));
  for (const budget of BUDGETS) assert.ok(binaries.includes(budget.file), budget.file + ' is not a bin');
  for (const binary of binaries) {
    assert.ok(BUDGETS.some((b) => b.file === binary), binary + ' has no budget');
  }
});

test('the expected exit code is derived from the worst declared severity', () => {
  assert.equal(expectedExit([]), 0);
  assert.equal(expectedExit(['a@minor']), 1);
  assert.equal(expectedExit(['a@moderate', 'b@minor']), 1);
  assert.equal(expectedExit(['a@serious', 'b@moderate']), 2);
  assert.equal(expectedExit(['a@critical', 'b@minor']), 3);
});

test('every artefact in the repository is covered by the exit code expectations', () => {
  const covered = new Set(expectations().map((row) => row.file));
  for (const pair of PAIRS) {
    assert.ok(covered.has(pair.before), pair.before + ' is not covered');
    assert.ok(covered.has(pair.after), pair.after + ' is not covered');
  }
  for (const fixture of FIXTURES) assert.ok(covered.has(fixture.file), fixture.file + ' is not covered');
  for (const limit of LIMITS) {
    assert.ok(covered.has(limit.blind), limit.blind + ' is not covered');
    assert.ok(covered.has(limit.contrast), limit.contrast + ' is not covered');
  }
  assert.equal(covered.size, PAIRS.length * 2 + FIXTURES.length + LIMITS.length * 2);
});

test('the text output of the tool can be read back into the same tokens as its JSON', () => {
  const text = [
    'a.php',
    '  critical line    2  charge-without-idempotency-key',
    '           A charge is sent with no idempotency key',
    '  minor    line   11  total-rounded-toward-zero',
    '',
    '2 findings: 1 critical, 0 serious, 0 moderate, 1 minor',
  ].join('\n');
  assert.deepEqual(tokensFromText(text),
    ['charge-without-idempotency-key@critical', 'total-rounded-toward-zero@minor']);
});

test('the text reader does not mistake the prose lines for findings', () => {
  const text = '  critical line    2  an-id\n           A sentence about it, with serious consequences\n';
  assert.deepEqual(tokensFromText(text), ['an-id@critical']);
});

test('the JSON reader collapses repeats into a set', () => {
  const json = JSON.stringify({
    findings: [
      { id: 'a', severity: 'minor' },
      { id: 'a', severity: 'minor' },
      { id: 'b', severity: 'serious' },
    ],
  });
  assert.deepEqual(tokensFromJson(json), ['a@minor', 'b@serious']);
});

test('the finding document is generated from the catalogue and is current on disk', () => {
  const generated = renderCatalogueDoc();
  assert.equal(read(CATALOGUE_DOC), generated,
    CATALOGUE_DOC + ' is stale; run node tools/catalogue-doc.mjs');
});

test('the finding document mentions every finding and says how many there are', () => {
  const generated = renderCatalogueDoc();
  for (const entry of CATALOGUE) {
    assert.ok(generated.includes('`' + entry.id + '`'), CATALOGUE_DOC + ' is missing ' + entry.id);
  }
  assert.ok(generated.includes(CATALOGUE.length + ' findings across'));
});

test('the finding document names something that reaches each finding', () => {
  const generated = renderCatalogueDoc();
  assert.equal(generated.includes('Reached by: `nothing`'), false,
    'a finding in the document is reached by nothing');
});

test('the limits document is generated from the limits and is current on disk', () => {
  const generated = renderLimitsDoc();
  assert.equal(read(LIMITS_DOC), generated,
    LIMITS_DOC + ' is stale; run node tools/limits-doc.mjs');
});

test('the limits document carries both files and both finding sets for every limit', () => {
  const generated = renderLimitsDoc();
  for (const limit of LIMITS) {
    assert.ok(generated.includes('`' + limit.id + '`'), 'missing ' + limit.id);
    assert.ok(generated.includes('`' + limit.blind + '`'), 'missing ' + limit.blind);
    assert.ok(generated.includes('`' + limit.contrast + '`'), 'missing ' + limit.contrast);
  }
});

test('every tool that asks whether it is the entry point spells the guard the same way', () => {
  // Keyed on the comparison rather than on the name of a helper variable,
  // because keying it on the name is exactly what let a tool in an earlier
  // repository build the URL by concatenating file:// onto a path, which never
  // matches on Windows, so both halves of it did nothing and exited zero.
  const files = [
    'bin/woo-check.mjs',
    'tools/count-tests.mjs',
    'tools/exit-codes.mjs',
    'tools/audit-verdicts.mjs',
    'tools/entry-thin.mjs',
    'tools/catalogue-doc.mjs',
    'tools/limits-doc.mjs',
    'tools/verify.mjs',
  ];
  const wanted = 'pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url';
  for (const file of files) {
    const source = read(file);
    const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    assert.ok(code.includes('import.meta.url'), file + ' never compares against import.meta.url');
    assert.ok(code.includes(wanted), file + ' does not spell the main module guard the agreed way');
    assert.equal(/['"]file:\/\/['"]\s*\+/.test(code), false,
      file + ' builds a file URL by concatenation, which is wrong on Windows');
  }
});

test('no tool redirects the output of an npm run, because npm prints a banner to it', () => {
  const workflow = read('.github/workflows/ci.yml');
  const lines = workflow.split('\n').filter((line) => !line.trim().startsWith('#'));
  for (const line of lines) {
    if (!/npm run/.test(line)) continue;
    assert.equal(/>/.test(line), false, 'a CI step redirects an npm run: ' + line.trim());
  }
});
