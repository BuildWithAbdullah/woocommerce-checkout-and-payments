// Generates docs/every-finding.md from src/catalogue.mjs, and with --check
// fails when the committed file is stale.
//
// A document is generated rather than written because the catalogue changes
// and prose does not notice. A hand written list of findings reads perfectly
// well after a finding has been added, renamed or had a severity taken away
// from it, and a reader who checks the list against the tool finds the
// document wrong. Generating it means that cannot happen.
//
// Note the main module guard below. An earlier tool in this family built it by
// concatenating 'file://' onto process.argv[1], which never matches on
// Windows, so both halves of the tool did nothing and exited 0, including the
// --check form CI depended on. A staleness gate that passes by never running
// is worse than no gate at all. Both sides are resolved to a real path and the
// URL is built with pathToFileURL.

import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

import { CATALOGUE, AREAS } from '../src/catalogue.mjs';
import { PAIRS } from '../patterns/manifest.mjs';
import { FIXTURES } from '../fixtures/manifest.mjs';

export const OUTPUT = 'docs/every-finding.md';

function reachedBy() {
  const map = new Map();
  const note = (id, where) => {
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(where);
  };
  for (const pair of PAIRS) {
    for (const token of pair.findings) note(token.split('@')[0], pair.slug);
  }
  for (const fixture of FIXTURES) {
    for (const token of fixture.findings) note(token.split('@')[0], fixture.file.replace(/^fixtures\//, ''));
  }
  return map;
}

export function render() {
  const reached = reachedBy();
  const out = [];

  out.push('# Every finding');
  out.push('');
  out.push('Generated from `src/catalogue.mjs` by `tools/catalogue-doc.mjs`. Do not edit it');
  out.push('by hand; CI fails when it does not match the catalogue.');
  out.push('');
  out.push('One entry per reason a checkout can be wrong, not one per check. Two checks');
  out.push('that fail for the same reason share an entry, and one check that can fail for');
  out.push('three reasons gets three.');
  out.push('');
  out.push('`Severities` is the complete set the finding can be emitted at, asserted in');
  out.push('both directions: a severity a real run produces that is not listed here fails');
  out.push('the build, and a severity listed here that no artefact in the repository has');
  out.push('ever produced fails the build too.');
  out.push('');
  out.push('`Reached by` names the example or fixture that produces it, so every row is');
  out.push('something you can run rather than something you have to believe.');
  out.push('');
  out.push(CATALOGUE.length + ' findings across ' + AREAS.length + ' areas.');
  out.push('');

  for (const area of AREAS) {
    const entries = CATALOGUE.filter((entry) => entry.area === area.id);
    out.push('## ' + area.title);
    out.push('');
    out.push('`' + area.id + '`, ' + entries.length + ' findings.');
    out.push('');
    for (const entry of entries) {
      out.push('### `' + entry.id + '`');
      out.push('');
      out.push(entry.title + '.');
      out.push('');
      out.push('- Severities: ' + entry.severities.map((s) => '`' + s + '`').join(', '));
      out.push('- What to do: ' + entry.remedy);
      out.push('- Reached by: ' + [...(reached.get(entry.id) || ['nothing'])].sort().map((w) => '`' + w + '`').join(', '));
      out.push('');
    }
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
      process.stderr.write(OUTPUT + ' is stale. Run: node tools/catalogue-doc.mjs\n');
      process.exitCode = 1;
    } else {
      process.stdout.write(OUTPUT + ' is current\n');
    }
  } else {
    writeFileSync(target, wanted);
    process.stdout.write('wrote ' + OUTPUT + '\n');
  }
}
