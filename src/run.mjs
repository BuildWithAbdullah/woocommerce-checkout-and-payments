// The runner. It decides what kind of file it has been given, hands it to
// every checker that reads that kind, and returns a flat list of findings.
// Nothing here knows about the filesystem, the terminal or process exit codes,
// so a test can drive the whole thing from strings.

import { parseElements } from './html.mjs';
import { entry, SEVERITY_RANK, exitCodeFor } from './catalogue.mjs';

import * as checkoutForm from './checks/checkout-form.mjs';
import * as paymentMethods from './checks/payment-methods.mjs';
import * as gatewayFailures from './checks/gateway-failures.mjs';
import * as taxAndShipping from './checks/tax-and-shipping.mjs';
import * as cartFragments from './checks/cart-fragments.mjs';
import * as scriptFootprint from './checks/script-footprint.mjs';
import * as orderFlow from './checks/order-flow.mjs';
import * as couponsAndPrices from './checks/coupons-and-prices.mjs';

export const CHECKERS = [
  checkoutForm, paymentMethods, gatewayFailures, taxAndShipping,
  cartFragments, scriptFootprint, orderFlow, couponsAndPrices,
];

const KIND_BY_EXTENSION = {
  '.html': 'html',
  '.htm': 'html',
  '.php': 'php',
  '.js': 'js',
  '.mjs': 'js',
  '.json': 'config',
  '.conf': 'conf',
  '.htaccess': 'conf',
};

export function kindFor(path) {
  const name = String(path);
  const dot = name.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = name.slice(dot).toLowerCase();
  return KIND_BY_EXTENSION[ext] || null;
}

export function isReadableKind(path) {
  return kindFor(path) !== null;
}

export function makeDoc(path, text) {
  const kind = kindFor(path);
  if (!kind) throw new Error('no checker reads ' + path);
  const doc = { path: String(path), kind, text: String(text) };
  if (kind === 'html') doc.elements = parseElements(doc.text);
  return doc;
}

// Findings are sorted so that two runs over the same input produce the same
// list in the same order, which is what lets a test compare them literally.
function order(a, b) {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  const rank = (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0);
  if (rank) return rank;
  if (a.line !== b.line) return a.line - b.line;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function checkDoc(doc) {
  const found = [];
  for (const checker of CHECKERS) {
    if (!checker.kinds.includes(doc.kind)) continue;
    for (const raw of checker.check(doc)) {
      const known = entry(raw.id); // throws on an id that is not catalogued
      if (!known.severities.includes(raw.severity)) {
        throw new Error(known.id + ' was emitted at ' + raw.severity + ', which it does not declare');
      }
      found.push({
        id: raw.id,
        area: known.area,
        severity: raw.severity,
        path: doc.path,
        line: raw.line || 1,
        detail: raw.detail || '',
        title: known.title,
        remedy: known.remedy,
      });
    }
  }
  // The same finding at the same line is one finding. Two checkers can reach
  // the same conclusion about the same element, and a reader does not want to
  // be told twice.
  const seen = new Set();
  const unique = [];
  for (const f of found) {
    const key = f.id + '@' + f.severity + '#' + f.line;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(f);
  }
  return unique.sort(order);
}

export function checkAll(docs) {
  const findings = [];
  for (const doc of docs) findings.push(...checkDoc(doc));
  return findings.sort(order);
}

export function summarise(findings) {
  const counts = { minor: 0, moderate: 0, serious: 0, critical: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;
  return {
    total: findings.length,
    counts,
    exitCode: exitCodeFor(findings.map((f) => f.severity)),
  };
}

// Token form used by every manifest in this repository: the exact set of
// "<id>@<severity>" strings a document produces. Comparing sets of these in
// both directions is what makes a corpus assertion catch a false positive,
// which an assertion that only checks the declared findings are present
// cannot do by construction.
export function tokensOf(findings) {
  return [...new Set(findings.map((f) => f.id + '@' + f.severity))].sort();
}

export function renderText(findings, summary) {
  if (!findings.length) return 'No findings.\n';
  const lines = [];
  let currentPath = null;
  for (const f of findings) {
    if (f.path !== currentPath) {
      currentPath = f.path;
      lines.push(currentPath);
    }
    lines.push('  ' + f.severity.padEnd(8) + ' line ' + String(f.line).padStart(4) + '  ' + f.id);
    lines.push('           ' + f.title);
    if (f.detail) lines.push('           ' + f.detail);
  }
  const c = summary.counts;
  lines.push('');
  lines.push(summary.total + ' findings: ' + c.critical + ' critical, ' + c.serious
    + ' serious, ' + c.moderate + ' moderate, ' + c.minor + ' minor');
  return lines.join('\n') + '\n';
}

export function renderJson(findings, summary) {
  return JSON.stringify({
    findings: findings.map((f) => ({
      id: f.id, area: f.area, severity: f.severity, path: f.path, line: f.line, detail: f.detail,
    })),
    total: summary.total,
    counts: summary.counts,
  }, null, 2) + '\n';
}
