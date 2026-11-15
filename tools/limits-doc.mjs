// Generates docs/what-the-checkers-cannot-see.md from src/limits.mjs, and with
// --check fails when the committed file is stale.
//
// This is the document that matters most for being generated. A paragraph
// saying a checker cannot see something still reads correctly after the
// checker has learned to see it, and a reader then trusts a caveat that is no
// longer true. Every limit here has two files beside it and both are asserted
// as exact sets, so the document cannot drift from what the code does.

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

import { LIMITS } from '../src/limits.mjs';

export const OUTPUT = 'docs/what-the-checkers-cannot-see.md';

const KIND_PROSE = {
  hides: 'The blind example below has the problem and nothing is reported for it.',
  manufactures: 'The blind example below does not have the problem, and a finding is reported anyway. This is a finding you have to know to discard.',
};

export function render() {
  const out = [];
  const hides = LIMITS.filter((limit) => limit.kind === 'hides');
  const manufactures = LIMITS.filter((limit) => limit.kind === 'manufactures');

  out.push('# What the checkers cannot see');
  out.push('');
  out.push('Generated from `src/limits.mjs` by `tools/limits-doc.mjs`. Do not edit it by');
  out.push('hand; CI fails when it does not match the limits.');
  out.push('');
  out.push(LIMITS.length + ' declared limits: ' + hides.length + ' that hide a problem and '
    + manufactures.length + ' that manufacture a finding where there is none.');
  out.push('');
  out.push('Each one has two files beside it under `limits/`. The blind file is where the');
  out.push('limit shows. The contrast file is the same subject handled in a way the same');
  out.push('checker gets right, which is what makes the entry a statement about the limit');
  out.push('rather than about the checker being broken. Both files have the exact set of');
  out.push('findings they produce declared in `src/limits.mjs`, compared in both');
  out.push('directions by `test/limits.test.mjs`.');
  out.push('');

  for (const limit of LIMITS) {
    out.push('## ' + limit.headline);
    out.push('');
    out.push('`' + limit.id + '`, kind `' + limit.kind + '`.');
    out.push('');
    out.push(limit.prose);
    out.push('');
    out.push(KIND_PROSE[limit.kind]);
    out.push('');
    out.push('| | File | Findings |');
    out.push('|---|---|---|');
    out.push('| Blind | `' + limit.blind + '` | '
      + (limit.blindFindings.length ? limit.blindFindings.map((t) => '`' + t + '`').join(', ') : 'none') + ' |');
    out.push('| Contrast | `' + limit.contrast + '` | '
      + (limit.contrastFindings.length ? limit.contrastFindings.map((t) => '`' + t + '`').join(', ') : 'none') + ' |');
    out.push('');
  }

  return out.join('\n');
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
  const target = join(root, OUTPUT);
  const wanted = render();

  if (process.argv.includes('--check')) {
    let found = '';
    try {
      found = readFileSync(target, 'utf8');
    } catch {
      found = '';
    }
    if (found !== wanted) {
      process.stderr.write(OUTPUT + ' is stale. Run: node tools/limits-doc.mjs\n');
      process.exitCode = 1;
    } else {
      process.stdout.write(OUTPUT + ' is current\n');
    }
  } else {
    writeFileSync(target, wanted);
    process.stdout.write('wrote ' + OUTPUT + '\n');
  }
}
