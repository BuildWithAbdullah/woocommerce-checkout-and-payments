// Counting tests, the only way that gives the same answer on every Node
// version this repository supports.
//
// Do not parse reporter text. The same suite printed `# tests 219` on Node 20
// and 22 and `info tests 219` on Node 24, so a regex over the output is a
// number that changes when the runtime changes and nothing else does.
//
// Do not use `run()` from node:test either, or not for counting: it forwards
// one `test:pass` per whole file on some versions, and `details.type` is
// 'suite' on some and undefined on others.
//
// What works everywhere is a custom reporter, where every per test event is
// present, selecting the events whose details type is not 'suite'. This file
// is both halves of that: the default export is the reporter, and running the
// file spawns `node --test` with itself as the reporter.
//
// A reporter counts a file that fails to load as one test. That is safe,
// because the failure count is then non-zero, but it means a count from a red
// run is not a count of anything. tools/verify.mjs refuses to compare the
// README against a suite that is not green.

import { readFileSync, writeFileSync, realpathSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function* countingReporter(source) {
  let tests = 0;
  let failures = 0;
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const details = event.data && event.data.details;
    if (details && details.type === 'suite') continue;
    tests += 1;
    if (event.type === 'test:fail') failures += 1;
  }
  const destination = process.env.COUNT_TESTS_OUT;
  if (destination) writeFileSync(destination, JSON.stringify({ tests, failures }));
  yield '';
}

// Reads the test file list out of package.json rather than keeping a second
// copy of it. The scripts entry is the one place the list lives.
export function testFilesFromPackage(packageJsonText) {
  const pkg = JSON.parse(packageJsonText);
  const command = String((pkg.scripts && pkg.scripts.test) || '');
  return command
    .replace(/^\s*node\s+--test\s*/, '')
    .split(/\s+/)
    .filter((part) => part && !part.startsWith('--'));
}

export function countTests(files, nodeBinary) {
  const destination = join(tmpdir(), 'woo-count-tests-' + process.pid + '-' + Date.now() + '.json');
  const self = pathToFileURL(fileURLToPath(import.meta.url)).href;
  const result = spawnSync(
    nodeBinary || process.execPath,
    ['--test', '--test-reporter=' + self, '--test-reporter-destination=stdout', ...files],
    { encoding: 'utf8', env: { ...process.env, COUNT_TESTS_OUT: destination } },
  );
  let counted = null;
  try {
    counted = JSON.parse(readFileSync(destination, 'utf8'));
    unlinkSync(destination);
  } catch {
    counted = null;
  }
  return {
    tests: counted ? counted.tests : 0,
    failures: counted ? counted.failures : -1,
    status: result.status,
    stderr: result.stderr || '',
  };
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
  const files = testFilesFromPackage(readFileSync('package.json', 'utf8'));
  const counted = countTests(files);
  if (counted.failures !== 0 || counted.status !== 0) {
    process.stderr.write('the suite is not green, so its count means nothing\n');
    process.stderr.write(counted.stderr.slice(-4000));
    process.exitCode = 1;
  } else {
    process.stdout.write(String(counted.tests) + '\n');
  }
}
