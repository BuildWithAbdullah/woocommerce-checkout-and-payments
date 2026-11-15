import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { claims, report, statedOnOneLine, importSpecifiers, SHIPPED_DIRECTORIES } from '../tools/verify.mjs';
import { listTracked, nodeTrackedPrimitives } from '../tools/tracked.mjs';
import { testFilesFromPackage } from '../tools/count-tests.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');
const exists = (relativePath) => existsSync(join(ROOT, relativePath));
const files = () => listTracked(ROOT, nodeTrackedPrimitives(fs, path, ROOT));

// The test count the verifier compares the README against is passed in rather
// than measured here. A verifier that runs the suite cannot be called from
// inside the suite, so the number the README states is used, and a test of its
// own below proves the claim is not vacuous.
function readmeTestCount() {
  const match = /\b(\d+) tests\b/.exec(read('README.md'));
  return match ? Number(match[1]) : -1;
}

function context(overrides) {
  return { read, exists, files: files(), testCount: readmeTestCount(), ...overrides };
}

test('a count stated once on one line passes, and zero or two fail', () => {
  assert.equal(statedOnOneLine('a\n7 things\nb', /\b7 things\b/), true);
  assert.equal(statedOnOneLine('a\nb', /\b7 things\b/), false);
  assert.equal(statedOnOneLine('7 things\nand again 7 things', /\b7 things\b/), false);
});

test('a count that has been allowed to wrap across two lines fails', () => {
  assert.equal(statedOnOneLine('there are 7\nthings here', /\b7 things\b/), false);
});

test('import specifiers are found and comments are not mistaken for imports', () => {
  const source = [
    "import { a } from './a.mjs';",
    "// import { b } from './b.mjs';",
    "export { c } from './c.mjs';",
    "import 'node:fs';",
    '/* import { d } from "./d.mjs"; */',
  ].join('\n');
  const found = importSpecifiers(source);
  assert.ok(found.includes('./a.mjs'));
  assert.ok(found.includes('./c.mjs'));
  assert.ok(found.includes('node:fs'));
  assert.equal(found.includes('./b.mjs'), false);
  assert.equal(found.includes('./d.mjs'), false);
});

test('every claim has a name and a boolean', () => {
  for (const entry of claims(context())) {
    assert.equal(typeof entry.name, 'string');
    assert.ok(entry.name.length > 10, 'a claim is barely named: ' + entry.name);
    assert.equal(typeof entry.ok, 'boolean');
  }
});

test('no two claims share a name', () => {
  const names = claims(context()).map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
});

test('every claim about this repository holds', () => {
  const result = report(context());
  assert.deepEqual(result.failed.map((entry) => entry.name + ' ' + entry.detail), []);
});

test('the number of assertions is the number of claims, and the README states it', () => {
  const result = report(context());
  assert.ok(result.total >= 40, 'expected at least forty claims, found ' + result.total);
  assert.ok(statedOnOneLine(read('README.md'), new RegExp('\\b' + result.total + ' repository assertions\\b')),
    'the README does not state ' + result.total + ' repository assertions on one line');
});

test('the total does not move when an unrelated document is added', () => {
  const extended = files().concat(['docs/something-else.md']);
  const withExtra = report(context({
    files: extended,
    read: (p) => (p === 'docs/something-else.md' ? '# Notes\n\nSomething unrelated.\n' : read(p)),
    exists: (p) => p === 'docs/something-else.md' || exists(p),
  }));
  assert.equal(withExtra.total, report(context()).total);
  assert.deepEqual(withExtra.failed.map((e) => e.name), []);
});

test('the total does not move when an extra source module is added', () => {
  const extended = files().concat(['src/extra.mjs']);
  const source = "import { CATALOGUE } from './catalogue.mjs';\nexport const count = CATALOGUE.length;\n";
  const withExtra = report(context({
    files: extended,
    read: (p) => (p === 'src/extra.mjs' ? source : read(p)),
    exists: (p) => p === 'src/extra.mjs' || exists(p),
  }));
  assert.equal(withExtra.total, report(context()).total);
  assert.deepEqual(withExtra.failed.map((e) => e.name), []);
});

test('the total does not move when a stray lockfile appears, and the lockfile claim fails', () => {
  const extended = files().concat(['package-lock.json']);
  const withLock = report(context({
    files: extended,
    read: (p) => (p === 'package-lock.json' ? '{"lockfileVersion":3}\n' : read(p)),
    exists: (p) => p === 'package-lock.json' || exists(p),
  }));
  assert.equal(withLock.total, report(context()).total);
  const failed = withLock.failed.map((entry) => entry.name);
  assert.ok(failed.some((name) => /lockfile/.test(name)), 'the stray lockfile was not noticed');
});

test('the dash claims are not vacuous: a file carrying one fails them', () => {
  const dash = String.fromCharCode(0x2014);
  const withDash = report(context({
    files: files().concat(['docs/with-a-dash.md']),
    read: (p) => (p === 'docs/with-a-dash.md' ? 'A line ' + dash + ' with one in it.\n' : read(p)),
    exists: (p) => p === 'docs/with-a-dash.md' || exists(p),
  }));
  assert.ok(withDash.failed.some((entry) => /em dash/.test(entry.name)));
});

test('the import claim is not vacuous: an import of a file that is not there fails it', () => {
  const broken = report(context({
    files: files().concat(['src/broken.mjs']),
    read: (p) => (p === 'src/broken.mjs' ? "import { x } from './not-here.mjs';\n" : read(p)),
    exists: (p) => p === 'src/broken.mjs' || exists(p),
  }));
  assert.ok(broken.failed.some((entry) => /resolves to a file that exists/.test(entry.name)));
});

test('the shipped import claim is not vacuous: a shipped file importing from tools fails it', () => {
  const broken = report(context({
    files: files().concat(['src/reaches-out.mjs']),
    read: (p) => (p === 'src/reaches-out.mjs' ? "import { parseIgnore } from '../tools/tracked.mjs';\n" : read(p)),
    exists: (p) => p === 'src/reaches-out.mjs' || exists(p),
  }));
  assert.ok(broken.failed.some((entry) => /does not ship/.test(entry.name)));
});

test('the README test count claim is not vacuous', () => {
  const wrong = report(context({ testCount: readmeTestCount() + 1 }));
  assert.ok(wrong.failed.some((entry) => /number of tests/.test(entry.name)));
});

test('the directories the verifier treats as shipped are the ones the package ships', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const dir of SHIPPED_DIRECTORIES) assert.ok(pkg.files.includes(dir), dir + ' is not shipped');
});

test('the suite named in the test script is the suite on disk', () => {
  const named = testFilesFromPackage(read('package.json')).sort();
  const onDisk = files().filter((file) => /^test\/.*\.test\.mjs$/.test(file)).sort();
  assert.deepEqual(named, onDisk);
});
