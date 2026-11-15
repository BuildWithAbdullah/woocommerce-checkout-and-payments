// Runs the real checkers over every artefact in the repository, in a separate
// process, through both output modes, and requires three things to agree: the
// text output, the JSON output, and the manifest.
//
// A tool with two output modes has to make the same assertions in both. The
// modes share a findings array here, so in principle they cannot disagree, and
// that is exactly the sort of thing worth checking rather than assuming: a
// renderer that drops a finding below a severity, or collapses two findings
// onto one line, would be invisible to a test that only reads the JSON.
//
// Separate process per artefact, so nothing a previous document left in a
// module can change the answer for the next one.

import { readFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

import { expectations } from './exit-codes.mjs';
import { CATALOGUE } from '../src/catalogue.mjs';

const KNOWN_IDS = new Set(CATALOGUE.map((entry) => entry.id));

// The text renderer prints two leading spaces, the severity, the word line,
// the line number and the id. Parsing it is the point: if the shape changes,
// this breaks, and the shape is part of what the tool promises.
export function tokensFromText(output) {
  const tokens = new Set();
  for (const line of String(output).split('\n')) {
    const match = /^\s{2}(minor|moderate|serious|critical)\s+line\s+\d+\s+(\S+)\s*$/.exec(line);
    if (match) tokens.add(match[2] + '@' + match[1]);
  }
  return [...tokens].sort();
}

export function tokensFromJson(output) {
  const parsed = JSON.parse(output);
  return [...new Set(parsed.findings.map((f) => f.id + '@' + f.severity))].sort();
}

function same(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function audit(binary, root, report) {
  let runs = 0;
  let bad = 0;

  for (const row of expectations()) {
    const expected = [...new Set(row.tokens)].sort();

    const textRun = spawnSync(process.execPath, [binary, row.file], { cwd: root, encoding: 'utf8' });
    const jsonRun = spawnSync(process.execPath, [binary, '--format', 'json', row.file], { cwd: root, encoding: 'utf8' });
    runs += 2;

    let fromText;
    let fromJson;
    try {
      fromText = tokensFromText(textRun.stdout);
      fromJson = tokensFromJson(jsonRun.stdout);
    } catch (error) {
      bad += 1;
      report('  ' + row.file + ' produced output that could not be read: ' + error.message);
      continue;
    }

    if (!same(fromText, fromJson)) {
      bad += 1;
      report('  ' + row.file + ' text says [' + fromText.join(' ') + '] and json says [' + fromJson.join(' ') + ']');
      continue;
    }
    if (!same(fromJson, expected)) {
      bad += 1;
      report('  ' + row.file + ' produced [' + fromJson.join(' ') + '] where the manifest declares [' + expected.join(' ') + ']');
      continue;
    }
    const unknown = fromJson.filter((token) => !KNOWN_IDS.has(token.split('@')[0]));
    if (unknown.length) {
      bad += 1;
      report('  ' + row.file + ' produced ids that are not catalogued: ' + unknown.join(' '));
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
  const binary = join(root, 'bin', 'woo-check.mjs');
  const report = (line) => process.stderr.write(line + '\n');
  const result = audit(binary, root, report);
  if (result.bad) {
    process.stderr.write(result.bad + ' of ' + result.runs + ' verifier runs disagreed with the manifests\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(result.runs + ' runs of the real checkers across both output modes, all agreeing with the manifests\n');
  }
}
