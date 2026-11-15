// Reads the repository's own artefacts, resolved from this file rather than
// from the working directory, so the suite gives the same answer wherever it
// is run from.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

import { makeDoc, checkDoc, tokensOf } from '../src/run.mjs';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

export function tokensForFile(relativePath) {
  return tokensOf(checkDoc(makeDoc(relativePath, read(relativePath))));
}

export function findingsForFile(relativePath) {
  return checkDoc(makeDoc(relativePath, read(relativePath)));
}

export function sameSet(actual, declared) {
  const a = [...new Set(actual)].sort();
  const b = [...new Set(declared)].sort();
  return { a, b, equal: a.length === b.length && a.every((value, index) => value === b[index]) };
}
