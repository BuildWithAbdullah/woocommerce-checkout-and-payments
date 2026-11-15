// The repository verifier: a fixed list of named claims about this repository,
// each one either true or false, and the total is the length of the list.
//
// This replaces the older style of verifier that counted assertions as it
// made them. That number looked impressive and meant almost nothing: it moved
// when a file was added, it moved when a document grew, and an assertion made
// once per file is a count of how many files the repository has rather than a
// count of what has been checked. A fixed list of named claims cannot drift
// that way, and test/verify.test.mjs proves it by adding an unrelated
// document, an extra source module and a stray lockfile and requiring the
// total to stay exactly the same while still failing on the two that are
// genuinely wrong.
//
// The claims take a context rather than reading the disk themselves, so the
// suite can exercise the list without this file running the suite. A verifier
// that runs the suite cannot be called from inside it.

import { readFileSync, realpathSync, existsSync, statSync, readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join, dirname, relative } from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { CATALOGUE, AREAS } from '../src/catalogue.mjs';
import { LIMITS, LIMIT_KINDS } from '../src/limits.mjs';
import { PAIRS } from '../patterns/manifest.mjs';
import { FIXTURES } from '../fixtures/manifest.mjs';
import { listTracked, nodeTrackedPrimitives } from './tracked.mjs';
import { testFilesFromPackage, countTests } from './count-tests.mjs';
import { BUDGETS, check as checkEntry } from './entry-thin.mjs';
import { render as renderCatalogueDoc, OUTPUT as CATALOGUE_DOC } from './catalogue-doc.mjs';
import { render as renderLimitsDoc, OUTPUT as LIMITS_DOC } from './limits-doc.mjs';

// Needles assembled at run time, so no file on disk contains the thing being
// searched for. A purity check that fails on its own subject matter is the
// oldest trap in this family of repositories.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const FORBIDDEN_WORDS = [
  String.fromCharCode(117, 110, 105, 118, 101, 114, 115, 105, 116, 121),
  String.fromCharCode(110, 117, 99, 101, 115),
];

export const SHIPPED_DIRECTORIES = ['bin', 'src', 'patterns', 'fixtures', 'limits', 'docs'];

// A count stated in the README has to be matched as a whole line, and the line
// must not be allowed to wrap. Exactly one matching line passes; zero means
// the README does not state it, and two means it states it twice and one of
// them will go stale.
export function statedOnOneLine(text, pattern) {
  const matching = String(text).split(/\r?\n/).filter((line) => pattern.test(line));
  return matching.length === 1;
}

function dropComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\/\/.*$/, '').replace(/\s\/\/.*$/, ''))
    .join('\n');
}

// An import or export is recognised only at the start of a line, after
// comments have been dropped. The looser form matched the same text inside a
// string literal, so a test that builds a fake module out of strings was read
// as importing the files it describes. The cost of the tighter form is that a
// module written all on one line would be missed, which no file here is.
export function importSpecifiers(source) {
  const code = dropComments(source);
  const found = [];
  const re = /^[ \t]*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/gm;
  let match;
  while ((match = re.exec(code)) !== null) found.push(match[1]);
  const bare = /^[ \t]*import\s*['"]([^'"]+)['"]/gm;
  while ((match = bare.exec(code)) !== null) found.push(match[1]);
  return found;
}

const READABLE_EXTENSIONS = ['.mjs', '.md', '.html', '.php', '.js', '.json', '.yml', '.conf'];

export function claims(context) {
  const { read, exists, files, testCount } = context;
  const readme = read('README.md');
  const pkg = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/ci.yml');
  const storeDoc = read('docs/store-description.md');
  const list = [];
  const claim = (name, ok, detail) => list.push({ name, ok: !!ok, detail: detail || '' });

  // ---- the licence and the prose ----------------------------------------
  claim('the licence is MIT and asks for nothing in return',
    /MIT License/.test(read('LICENSE')) && /without restriction/.test(read('LICENSE')));
  claim('the README names the licence the repository actually carries',
    /\bMIT\b/.test(readme) && pkg.license === 'MIT');
  claim('no file contains an em dash',
    files.every((file) => !read(file).includes(EM_DASH)),
    files.filter((file) => read(file).includes(EM_DASH)).join(' '));
  claim('no file contains an en dash',
    files.every((file) => !read(file).includes(EN_DASH)),
    files.filter((file) => read(file).includes(EN_DASH)).join(' '));
  claim('no file mentions a place of education',
    files.every((file) => {
      const text = read(file).toLowerCase();
      return FORBIDDEN_WORDS.every((word) => !text.includes(word));
    }));
  claim('the README has a section saying how to verify the repository',
    /^##\s+Verifying\s*$/m.test(readme));
  claim('the README explains every exit code the tool can return',
    ['0', '1', '2', '3', '64'].every((code) => new RegExp('\\|\\s*`?' + code + '`?\\s*\\|').test(readme)));
  claim('the README says what the repository deliberately does not do',
    /cannot see/i.test(readme));

  // ---- the counts the README states -------------------------------------
  claim('the README states the number of findings, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + CATALOGUE.length + ' catalogued findings\\b')));
  claim('the README states the number of areas, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + AREAS.length + ' areas\\b')));
  claim('the README states the number of pattern pairs, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + PAIRS.length + ' pattern pairs\\b')));
  claim('the README states the number of fixtures, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + FIXTURES.length + ' fixtures\\b')));
  claim('the README states the number of declared limits, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + LIMITS.length + ' declared limits\\b')));
  claim('the README states the number of tests, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + testCount + ' tests\\b')));

  // ---- the engines floor -------------------------------------------------
  const floor = String((pkg.engines && pkg.engines.node) || '');
  const floorMatch = /^>=(\d+\.\d+\.\d+)$/.exec(floor);
  claim('the engines floor names an exact version and keeps the operator',
    !!floorMatch, 'engines.node is "' + floor + '"');
  const floorVersion = floorMatch ? floorMatch[1] : null;
  claim('the CI matrix runs the exact version the engines floor names',
    !!floorVersion && new RegExp("'" + floorVersion.replace(/\./g, '\\.') + "'").test(workflow));
  const matrix = [...workflow.matchAll(/'(\d+\.\d+\.\d+)'/g)].map((m) => m[1]);
  claim('the CI matrix runs at least three Node versions',
    new Set(matrix).size >= 3, 'matrix is ' + [...new Set(matrix)].join(' '));
  claim('every version in the CI matrix names all three components',
    !/node-version:\s*\[[^\]]*'\d+'/.test(workflow) && !/node-version:\s*\[[^\]]*'\d+\.\d+'/.test(workflow));
  claim('CI has a job that proves the engines floor actually refuses an older runtime',
    /engines floor actually refuses/.test(workflow));
  claim('no CI step redirects the output of an npm run, because npm writes a banner to it',
    workflow.split('\n').filter((line) => !line.trim().startsWith('#'))
      .every((line) => !(/npm run/.test(line) && />/.test(line))));

  // ---- the package -------------------------------------------------------
  claim('the package declares itself a module, which every file here assumes',
    pkg.type === 'module');
  claim('the package has no dependencies, so a red build means something',
    !pkg.dependencies && !pkg.peerDependencies);
  claim('the package tracks no lockfile, which is consistent with having no dependencies',
    !exists('package-lock.json') && !files.includes('package-lock.json'));
  claim('the gitignore keeps a lockfile and node modules out',
    /node_modules\//.test(read('.gitignore')) && /package-lock\.json/.test(read('.gitignore')));
  claim('every binary the package declares exists and starts with a shebang',
    Object.values(pkg.bin || {}).every((p) => {
      const file = p.replace(/^\.\//, '');
      return exists(file) && read(file).startsWith('#!');
    }));
  claim('every binary the package declares has an entry point budget',
    Object.values(pkg.bin || {}).every((p) => BUDGETS.some((b) => b.file === p.replace(/^\.\//, ''))));
  claim('every directory the package ships exists and is listed in the files field',
    SHIPPED_DIRECTORIES.every((dir) => (pkg.files || []).includes(dir)));

  // ---- imports -----------------------------------------------------------
  const moduleFiles = files.filter((file) => file.endsWith('.mjs'));
  const unresolved = [];
  const outsideShipped = [];
  for (const file of moduleFiles) {
    for (const specifier of importSpecifiers(read(file))) {
      if (!specifier.startsWith('.')) {
        if (!specifier.startsWith('node:')) unresolved.push(file + ' -> ' + specifier);
        continue;
      }
      // Resolved against the importing file, not against the repository root.
      // Resolving against the root is the mistake that makes this check pass
      // for an import that cannot possibly work.
      const target = join(dirname(file), specifier).split('\\').join('/');
      if (!exists(target)) unresolved.push(file + ' -> ' + specifier);
      const shipped = SHIPPED_DIRECTORIES.some((dir) => file.startsWith(dir + '/'));
      const targetShipped = SHIPPED_DIRECTORIES.some((dir) => target.startsWith(dir + '/'));
      if (shipped && !targetShipped) outsideShipped.push(file + ' -> ' + target);
    }
  }
  claim('every import in the repository resolves to a file that exists',
    unresolved.length === 0, unresolved.join(' '));
  claim('nothing the package ships imports from a directory it does not ship',
    outsideShipped.length === 0, outsideShipped.join(' '));
  claim('every import of a package outside this one is a node builtin',
    moduleFiles.every((file) => importSpecifiers(read(file))
      .every((s) => s.startsWith('.') || s.startsWith('node:'))));

  // ---- the corpus --------------------------------------------------------
  claim('every pattern pair has both of its files in the repository',
    PAIRS.every((pair) => exists(pair.before) && exists(pair.after)));
  claim('every pattern pair differs between its two files',
    PAIRS.every((pair) => read(pair.before) !== read(pair.after)));
  claim('every fixture has its file in the repository',
    FIXTURES.every((fixture) => exists(fixture.file)));
  claim('every declared limit has both of its files in the repository',
    LIMITS.every((limit) => exists(limit.blind) && exists(limit.contrast)));
  claim('every file under patterns, fixtures and limits is referenced by a manifest',
    (() => {
      const referenced = new Set();
      for (const pair of PAIRS) { referenced.add(pair.before); referenced.add(pair.after); }
      for (const fixture of FIXTURES) referenced.add(fixture.file);
      for (const limit of LIMITS) { referenced.add(limit.blind); referenced.add(limit.contrast); }
      const orphans = files.filter((file) =>
        /^(patterns|fixtures|limits)\//.test(file) && !/manifest\.mjs$/.test(file) && !referenced.has(file));
      return orphans.length === 0;
    })());
  claim('no artefact in the repository is empty',
    files.every((file) => read(file).trim().length > 0));
  claim('every PHP artefact opens with the PHP tag',
    files.filter((file) => file.endsWith('.php')).every((file) => read(file).startsWith('<' + '?php')));
  claim('every JSON file in the repository parses',
    files.filter((file) => file.endsWith('.json')).every((file) => {
      try { JSON.parse(read(file)); return true; } catch { return false; }
    }));
  claim('every tracked file is of a kind this repository means to carry',
    files.every((file) => READABLE_EXTENSIONS.some((ext) => file.endsWith(ext)) || file === 'LICENSE' || file === '.gitignore'),
    files.filter((file) => !READABLE_EXTENSIONS.some((ext) => file.endsWith(ext)) && file !== 'LICENSE' && file !== '.gitignore').join(' '));

  // ---- the catalogue -----------------------------------------------------
  claim('every catalogued finding is reached by a pattern pair or a fixture',
    (() => {
      const reached = new Set();
      for (const pair of PAIRS) for (const token of pair.findings) reached.add(token.split('@')[0]);
      for (const fixture of FIXTURES) for (const token of fixture.findings) reached.add(token.split('@')[0]);
      return CATALOGUE.every((entry) => reached.has(entry.id));
    })());
  claim('every area carries at least four findings, so no area is a heading with one item under it',
    AREAS.every((area) => CATALOGUE.filter((entry) => entry.area === area.id).length >= 4));
  claim('no finding id is used twice',
    new Set(CATALOGUE.map((entry) => entry.id)).size === CATALOGUE.length);
  claim('both kinds of declared limit are represented',
    LIMIT_KINDS.every((kind) => LIMITS.some((limit) => limit.kind === kind)));
  claim('at least ten limits are declared',
    LIMITS.length >= 10);

  // ---- the documents -----------------------------------------------------
  claim('the generated finding document matches the catalogue',
    read(CATALOGUE_DOC) === renderCatalogueDoc());
  claim('the generated limits document matches the limits',
    read(LIMITS_DOC) === renderLimitsDoc());
  claim('the store description document explains every key the settings checker reads',
    (() => {
      const checker = read('src/checks/tax-and-shipping.mjs');
      const keys = ['based_on', 'digital_tax_location', 'zero_rate_handling', 'sells_digital_goods',
        'rest_of_world', 'calculation_type', 'class_costs', 'before_discount', 'min_amount'];
      return keys.every((key) => checker.includes(key) && storeDoc.includes(key));
    })());

  // ---- the suite ---------------------------------------------------------
  const namedTestFiles = testFilesFromPackage(read('package.json'));
  claim('the test script names every test file in the repository',
    (() => {
      const onDisk = files.filter((file) => /^test\/.*\.test\.mjs$/.test(file)).sort();
      return JSON.stringify(onDisk) === JSON.stringify([...namedTestFiles].sort());
    })());
  claim('every test file the script names is in the repository',
    namedTestFiles.every((file) => exists(file)));
  claim('the suite asserts the pattern sets as exact sets rather than by containment',
    (() => {
      const source = dropComments(read('test/pairs.test.mjs'));
      return /deepEqual\(produced, \[\.\.\.pair\.findings\]\.sort\(\)/.test(source)
        && /deepEqual\(produced, \[\.\.\.pair\.residual\]\.sort\(\)/.test(source)
        && !/produced\.includes\(/.test(source);
    })());
  claim('the suite asserts the declared severities in both directions',
    (() => {
      const source = read('test/catalogue.test.mjs');
      return /every severity a run produces is one the catalogue declares/.test(source)
        && /every severity the catalogue declares is produced/.test(source);
    })());
  claim('every checker module in the tree is imported by the runner',
    (() => {
      const runner = read('src/run.mjs');
      const checkers = files.filter((file) => /^src\/checks\/.*\.mjs$/.test(file));
      return checkers.length === AREAS.length
        && checkers.every((file) => runner.includes(file.replace('src/', './')));
    })());
  claim('the entry point is inside its budget',
    checkEntry('', read).failures.length === 0);
  claim('every tool spells the main module guard the agreed way',
    (() => {
      const wanted = 'pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url';
      const guarded = files.filter((file) =>
        /^(tools|bin)\//.test(file) && dropComments(read(file)).includes('import.meta.url'));
      return guarded.length >= 8 && guarded.every((file) => {
        const code = dropComments(read(file));
        return code.includes(wanted) && !/['"]file:\/\/['"]\s*\+/.test(code);
      });
    })());

  // Last, and deliberately so: the total is the length of this list including
  // this claim, so the figure the README states is checked against the thing
  // the figure describes.
  claim('the README states the number of repository assertions, once, on one line',
    statedOnOneLine(readme, new RegExp('\\b' + (list.length + 1) + ' repository assertions\\b')));

  return list;
}

export function report(context) {
  const made = claims(context);
  const failed = made.filter((entry) => !entry.ok);
  return { total: made.length, failed, claims: made };
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const files = listTracked(root, nodeTrackedPrimitives(fs, path, root));
  const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');
  const exists = (relativePath) => existsSync(join(root, relativePath));

  const counted = countTests(testFilesFromPackage(read('package.json')).map((f) => join(root, f)));
  if (counted.failures !== 0 || counted.status !== 0) {
    process.stderr.write('the suite is not green, so no count from it is worth comparing against\n');
    process.stderr.write(counted.stderr.slice(-4000));
    process.exitCode = 1;
  } else {
    const result = report({ read, exists, files, testCount: counted.tests });
    for (const entry of result.failed) {
      process.stderr.write('FAILED: ' + entry.name + (entry.detail ? ' [' + entry.detail + ']' : '') + '\n');
    }
    process.stdout.write(result.total + ' repository assertions, ' + counted.tests + ' tests\n');
    if (result.failed.length) process.exitCode = 1;
  }
}
