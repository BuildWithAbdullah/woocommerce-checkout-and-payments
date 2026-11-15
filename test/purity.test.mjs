import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { listTracked, nodeTrackedPrimitives } from '../tools/tracked.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FILES = listTracked(ROOT, nodeTrackedPrimitives(fs, path, ROOT));
const read = (relativePath) => readFileSync(join(ROOT, relativePath), 'utf8');

// Assembled from code points so that no file in this repository contains the
// character being searched for. A purity check that fails on its own subject
// matter is a trap this family of repositories has fallen into more than once,
// and the related one is worth writing down: a unicode escape written inside
// an unquoted heredoc comes out as the real character, so the escape does not
// survive being written through a shell.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

test('the repository has files to check', () => {
  assert.ok(FILES.length > 60, 'only ' + FILES.length + ' tracked files');
});

test('no tracked file contains an em dash', () => {
  const offenders = FILES.filter((file) => read(file).includes(EM_DASH));
  assert.deepEqual(offenders, []);
});

test('no tracked file contains an en dash', () => {
  const offenders = FILES.filter((file) => read(file).includes(EN_DASH));
  assert.deepEqual(offenders, []);
});

test('the dash check is not vacuous, because it finds one when there is one', () => {
  assert.equal(('a line ' + EM_DASH + ' here').includes(EM_DASH), true);
  assert.equal(('a line ' + EN_DASH + ' here').includes(EN_DASH), true);
});

test('no tracked file names a place of education', () => {
  const needles = [
    String.fromCharCode(117, 110, 105, 118, 101, 114, 115, 105, 116, 121),
    String.fromCharCode(110, 117, 99, 101, 115),
    String.fromCharCode(99, 111, 108, 108, 101, 103, 101),
  ];
  const offenders = [];
  for (const file of FILES) {
    const text = read(file).toLowerCase();
    for (const needle of needles) if (text.includes(needle)) offenders.push(file + ' / ' + needle);
  }
  assert.deepEqual(offenders, []);
});

test('no example names a real domain that somebody could own', () => {
  // Every example host in this repository is either a documented example
  // domain or a reserved test name, so nothing here points at a live site.
  const allowed = /(example\.(test|com|org|net)|[a-z0-9-]+\.test|localhost|js\.stripe\.com|js\.braintreegateway\.com|paypal\.com|checkout\.adyen\.com|checkout\.razorpay\.com|js\.squareup(sandbox)?\.com|docs\.claude\.com|google\.com|github\.com)$/;
  const offenders = [];
  for (const file of FILES) {
    if (!/\.(html|php|js|mjs|json|md)$/.test(file)) continue;
    for (const match of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = match[1].toLowerCase().replace(/\.$/, '');
      if (!allowed.test(host)) offenders.push(file + ' -> ' + host);
    }
  }
  assert.deepEqual([...new Set(offenders)], []);
});

test('no example carries a plausible real card number', () => {
  const offenders = [];
  for (const file of FILES) {
    const text = read(file);
    for (const match of text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)) {
      const digits = match[0].replace(/[^0-9]/g, '');
      if (digits.length >= 13) offenders.push(file + ' -> ' + digits.length + ' digits');
    }
  }
  assert.deepEqual([...new Set(offenders)], []);
});

test('no artefact mentions a client or a delivered engagement', () => {
  // Built from fragments at run time, so this file does not itself contain
  // the phrases it is looking for. An assertion that scans source for a
  // forbidden token will otherwise read its own declaration and report it.
  const customer = String.fromCharCode(99, 108, 105, 101, 110, 116);
  const needles = [
    customer + ' ' + 'name',
    'our' + ' ' + customer,
    'for a ' + customer + ' we',
    'deliv' + 'ered for',
  ];
  const offenders = [];
  for (const file of FILES) {
    const text = read(file).toLowerCase();
    for (const needle of needles) if (text.includes(needle)) offenders.push(file + ' / ' + needle);
  }
  assert.deepEqual(offenders, []);
});

test('every artefact uses the invented prefix rather than a real plugin name', () => {
  // Assembled for the same reason as above.
  const realPluginNames = [
    'woo' + 'commerce-gateway-stripe',
    'woo' + '-paypal-express',
  ];
  const offenders = [];
  for (const file of FILES) {
    if (!/^(patterns|fixtures|limits)\//.test(file)) continue;
    const text = read(file).toLowerCase();
    for (const name of realPluginNames) if (text.includes(name)) offenders.push(file + ' / ' + name);
  }
  assert.deepEqual(offenders, []);
});

test('every source and tool file ends with exactly one newline', () => {
  const offenders = FILES.filter((file) => {
    if (!/\.(mjs|json|md|yml)$/.test(file)) return false;
    const text = read(file);
    return !text.endsWith('\n') || text.endsWith('\n\n');
  });
  assert.deepEqual(offenders, []);
});

test('no tracked file has a tab in a JavaScript module, because the PHP examples use them and the modules do not', () => {
  const offenders = FILES.filter((file) => file.endsWith('.mjs') && read(file).includes('\t'));
  assert.deepEqual(offenders, []);
});

test('no tracked file has trailing whitespace on a line', () => {
  const offenders = [];
  for (const file of FILES) {
    if (!/\.(mjs|json|md|yml|html|php|js)$/.test(file)) continue;
    const lines = read(file).split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (/[ \t]+$/.test(lines[index])) offenders.push(file + ':' + (index + 1));
    }
  }
  assert.deepEqual(offenders.slice(0, 10), []);
});
