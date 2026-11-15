// Fails the build if a decision moves into a file no test can import.
//
// The entry point in bin/ can only be reached by spawning a process, so
// nothing in it is covered by the suite, and `node --check` on it proves only
// that it parses. That is precisely where the worst defect this family of
// repositories has shipped lived: a binary that printed nothing and exited 0
// through the symlink npm installs it as, for the whole life of the package,
// while fifty tests passed.
//
// The answer is to keep the entry point as wiring and assert that it stays
// that way. The budget is the size it is now, so growth fails rather than
// creeping. The branch budget has no headroom at all, because a branch in the
// entry point is a decision, and a decision there is the thing being banned.

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

export const BUDGETS = [
  { file: 'bin/woo-check.mjs', lines: 24, branches: 3 },
];

// Comments are dropped before anything is counted. An assertion that scans
// source for a construct will otherwise read the comment explaining the
// construct and report the explanation.
export function stripComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

export function measure(source) {
  const code = stripComments(source);
  const lines = code.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const branchPatterns = [
    /\bif\s*\(/g,
    /\belse\b/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcatch\s*[({]/g,
    /\?[^.]/g,
    /&&/g,
    /\|\|/g,
  ];
  let branches = 0;
  for (const pattern of branchPatterns) {
    branches += (code.match(pattern) || []).length;
  }
  return { lines: lines.length, branches };
}

export function check(root, read) {
  const failures = [];
  const measured = [];
  for (const budget of BUDGETS) {
    const found = measure(read(join(root, budget.file)));
    measured.push({ file: budget.file, ...found, budget });
    if (found.lines > budget.lines) {
      failures.push(budget.file + ' is ' + found.lines + ' code lines, budget ' + budget.lines);
    }
    if (found.branches > budget.branches) {
      failures.push(budget.file + ' has ' + found.branches + ' branches, budget ' + budget.branches);
    }
  }
  return { failures, measured };
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
  const result = check(root, (p) => readFileSync(p, 'utf8'));
  for (const row of result.measured) {
    process.stdout.write(row.file + ': ' + row.lines + ' of ' + row.budget.lines + ' lines, '
      + row.branches + ' of ' + row.budget.branches + ' branches\n');
  }
  if (result.failures.length) {
    for (const failure of result.failures) process.stderr.write(failure + '\n');
    process.exitCode = 1;
  }
}
