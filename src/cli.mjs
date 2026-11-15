// Every decision the command line tool makes lives here, and the entry point
// in bin/ is nothing but wiring. The reason is that a file which can only be
// reached by spawning a process is a file no test can import, and the entry
// point is exactly where this repository has to be most careful: a binary
// that prints nothing and exits zero looks identical to a clean run.
//
// tools/entry-thin.mjs fails the build if a decision moves back into bin/.
//
// Everything this function needs is an argument: the argv, the two output
// streams, the filesystem reader, and the work function itself. Nothing is
// imported for its side effects and nothing reads process.

import { makeDoc, checkAll, summarise, renderText, renderJson, isReadableKind, kindFor } from './run.mjs';
import { USAGE_EXIT, CATALOGUE, AREAS } from './catalogue.mjs';

export const USAGE = [
  'woo-check - read a WooCommerce checkout for the things that go wrong',
  '',
  'Usage:',
  '  woo-check <file|directory> [more paths...]   check the paths given',
  '  woo-check --format json <paths...>           machine readable output',
  '  woo-check --list                             print the finding catalogue',
  '  woo-check --help                             print this',
  '',
  'It reads .html, .php, .js, .mjs, .json and .conf files. A directory is',
  'walked and every readable file in it is checked.',
  '',
  'Exit codes:',
  '  0  nothing found',
  '  1  the worst finding is minor or moderate',
  '  2  the worst finding is serious',
  '  3  the worst finding is critical',
  '  64 the arguments did not make sense',
].join('\n');

export function parseArgs(argv) {
  const paths = [];
  let format = 'text';
  let mode = 'check';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { mode: 'help', format, paths };
    if (arg === '--list') { mode = 'list'; continue; }
    if (arg === '--format') {
      const value = argv[++i];
      if (value !== 'text' && value !== 'json') {
        return { mode: 'error', message: '--format takes text or json', format, paths };
      }
      format = value;
      continue;
    }
    if (arg === '--format=json' || arg === '--format=text') {
      format = arg.split('=')[1];
      continue;
    }
    if (arg.startsWith('-')) return { mode: 'error', message: 'unknown option ' + arg, format, paths };
    paths.push(arg);
  }
  if (mode === 'check' && !paths.length) {
    return { mode: 'error', message: 'no paths given', format, paths };
  }
  return { mode, format, paths };
}

function listText() {
  const lines = [];
  for (const area of AREAS) {
    const entries = CATALOGUE.filter((e) => e.area === area.id);
    lines.push(area.id + '  ' + area.title + '  (' + entries.length + ')');
    for (const e of entries) {
      lines.push('  ' + e.id + '  [' + e.severities.join(' ') + ']');
    }
  }
  lines.push('');
  lines.push(CATALOGUE.length + ' findings across ' + AREAS.length + ' areas');
  return lines.join('\n') + '\n';
}

function listJson() {
  return JSON.stringify({
    areas: AREAS,
    findings: CATALOGUE.map((e) => ({ id: e.id, area: e.area, severities: e.severities, title: e.title })),
  }, null, 2) + '\n';
}

// io: { out(string), err(string) }
// files: { read(path) -> string, walk(path) -> string[], exists(path) -> bool }
export function main(argv, io, files) {
  const parsed = parseArgs(argv);

  if (parsed.mode === 'help') {
    io.out(USAGE + '\n');
    return 0;
  }
  if (parsed.mode === 'error') {
    io.err(parsed.message + '\n\n' + USAGE + '\n');
    return USAGE_EXIT;
  }
  if (parsed.mode === 'list') {
    io.out(parsed.format === 'json' ? listJson() : listText());
    return 0;
  }

  const targets = [];
  for (const path of parsed.paths) {
    if (!files.exists(path)) {
      io.err('no such path: ' + path + '\n');
      return USAGE_EXIT;
    }
    for (const found of files.walk(path)) {
      if (isReadableKind(found)) targets.push(found);
    }
  }

  if (!targets.length) {
    io.err('none of the paths given hold a file this tool reads\n');
    return USAGE_EXIT;
  }

  const docs = [];
  for (const path of targets) {
    docs.push(makeDoc(path, files.read(path)));
  }

  const findings = checkAll(docs);
  const summary = summarise(findings);
  io.out(parsed.format === 'json' ? renderJson(findings, summary) : renderText(findings, summary));
  return summary.exitCode;
}

export { kindFor };
