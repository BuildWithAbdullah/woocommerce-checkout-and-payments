// Runs the real binary over every artefact in the repository and checks the
// exit code against one derived from the manifests and the severity table.
//
// The expectation is derived, not listed. A list kept inside this tool is a
// second copy of the manifests that can disagree with them, and the whole
// point of the tool is to catch the case where the library is right and the
// thing a reader actually installs is not.
//
// It is run through a symlink as well as directly, because npm installs a bin
// as a symlink and Node resolves a module path to its real path. A main module
// guard that compares an unresolved argv[1] against import.meta.url matches
// nothing through that symlink, so the binary prints nothing and exits 0 for
// its whole life while every test passes. That has happened on this account.

import { readFileSync, realpathSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PAIRS } from '../patterns/manifest.mjs';
import { FIXTURES } from '../fixtures/manifest.mjs';
import { LIMITS } from '../src/limits.mjs';
import { SEVERITY_RANK, USAGE_EXIT } from '../src/catalogue.mjs';

export function expectedExit(tokens) {
  if (!tokens.length) return 0;
  const worst = Math.max(...tokens.map((t) => SEVERITY_RANK[t.split('@')[1]] || 0));
  if (worst >= 4) return 3;
  if (worst === 3) return 2;
  return 1;
}

// Every artefact in the repository, each with the exit code its declared
// finding set implies.
export function expectations() {
  const rows = [];
  for (const pair of PAIRS) {
    rows.push({ file: pair.before, tokens: pair.findings });
    rows.push({ file: pair.after, tokens: pair.residual });
  }
  for (const fixture of FIXTURES) rows.push({ file: fixture.file, tokens: fixture.findings });
  for (const limit of LIMITS) {
    rows.push({ file: limit.blind, tokens: limit.blindFindings });
    rows.push({ file: limit.contrast, tokens: limit.contrastFindings });
  }
  return rows.map((row) => ({ ...row, exit: expectedExit(row.tokens) }));
}

function runBinary(binary, args, cwd) {
  const result = spawnSync(process.execPath, [binary, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

export function checkAgainst(binary, root, report) {
  let runs = 0;
  let bad = 0;

  for (const row of expectations()) {
    for (const format of ['text', 'json']) {
      const args = format === 'json' ? ['--format', 'json', row.file] : [row.file];
      const run = runBinary(binary, args, root);
      runs += 1;
      if (run.status !== row.exit) {
        bad += 1;
        report('  ' + row.file + ' (' + format + ') exited ' + run.status + ', expected ' + row.exit);
        continue;
      }
      if (!run.stdout.trim()) {
        bad += 1;
        report('  ' + row.file + ' (' + format + ') printed nothing at all');
      }
    }
  }

  // The usage paths, which are the ones a wrapper script gets wrong.
  const usage = [
    { args: [], exit: USAGE_EXIT },
    { args: ['--format', 'xml', 'patterns'], exit: USAGE_EXIT },
    { args: ['definitely-not-here.html'], exit: USAGE_EXIT },
    { args: ['--help'], exit: 0 },
    { args: ['--list'], exit: 0 },
    { args: ['--list', '--format', 'json'], exit: 0 },
  ];
  for (const row of usage) {
    const run = runBinary(binary, row.args, root);
    runs += 1;
    if (run.status !== row.exit) {
      bad += 1;
      report('  woo-check ' + row.args.join(' ') + ' exited ' + run.status + ', expected ' + row.exit);
    }
    if (row.exit === 0 && !run.stdout.trim()) {
      bad += 1;
      report('  woo-check ' + row.args.join(' ') + ' printed nothing');
    }
  }

  return { runs, bad };
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
  const direct = join(root, 'bin', 'woo-check.mjs');
  const report = (line) => process.stderr.write(line + '\n');

  const first = checkAgainst(direct, root, report);

  const temporary = mkdtempSync(join(tmpdir(), 'woo-bin-'));
  const linked = join(temporary, 'woo-check');
  symlinkSync(direct, linked);
  const second = checkAgainst(linked, root, report);
  rmSync(temporary, { recursive: true, force: true });

  const runs = first.runs + second.runs;
  const bad = first.bad + second.bad;

  if (bad) {
    process.stderr.write(bad + ' of ' + runs + ' runs of the real binary were wrong\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(runs + ' runs of the real binary, directly and through a symlink, all as declared\n');
  }
}
