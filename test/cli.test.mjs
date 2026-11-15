import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs, main, USAGE } from '../src/cli.mjs';
import { USAGE_EXIT, CATALOGUE } from '../src/catalogue.mjs';
import { makeFiles } from '../src/files.mjs';

// A filesystem made of strings, so every decision the command line tool makes
// can be driven without touching a disk.
function fakeFiles(tree) {
  return makeFiles({
    readFile: (p) => {
      if (!(p in tree)) throw new Error('no such file ' + p);
      return tree[p];
    },
    exists: (p) => p in tree || Object.keys(tree).some((k) => k.startsWith(p + '/')),
    isDirectory: (p) => !(p in tree) && Object.keys(tree).some((k) => k.startsWith(p + '/')),
    readDirectory: (p) => {
      const prefix = p === '.' ? '' : p + '/';
      const names = new Set();
      for (const key of Object.keys(tree)) {
        if (!key.startsWith(prefix)) continue;
        names.add(key.slice(prefix.length).split('/')[0]);
      }
      return [...names];
    },
    join: (a, b) => (a === '.' ? b : a + '/' + b),
  });
}

function capture() {
  const out = [];
  const err = [];
  return { io: { out: (s) => out.push(s), err: (s) => err.push(s) }, out, err };
}

test('a path on its own is a check in text format', () => {
  assert.deepEqual(parseArgs(['a.html']), { mode: 'check', format: 'text', paths: ['a.html'] });
});

test('the format may be given as two arguments or as one', () => {
  assert.equal(parseArgs(['--format', 'json', 'a.html']).format, 'json');
  assert.equal(parseArgs(['--format=json', 'a.html']).format, 'json');
  assert.equal(parseArgs(['--format=text', 'a.html']).format, 'text');
});

test('a format that is not offered is a usage error rather than a silent default', () => {
  const parsed = parseArgs(['--format', 'xml', 'a.html']);
  assert.equal(parsed.mode, 'error');
  assert.match(parsed.message, /text or json/);
});

test('help wins over everything after it', () => {
  assert.equal(parseArgs(['a.html', '--help']).mode, 'help');
  assert.equal(parseArgs(['-h']).mode, 'help');
});

test('listing the catalogue needs no paths', () => {
  assert.equal(parseArgs(['--list']).mode, 'list');
  assert.equal(parseArgs(['--list', '--format', 'json']).format, 'json');
});

test('no paths at all is a usage error', () => {
  assert.equal(parseArgs([]).mode, 'error');
  assert.match(parseArgs([]).message, /no paths/);
});

test('an unknown option is a usage error naming the option', () => {
  const parsed = parseArgs(['--colour']);
  assert.equal(parsed.mode, 'error');
  assert.match(parsed.message, /--colour/);
});

test('help prints the usage and exits zero', () => {
  const { io, out } = capture();
  assert.equal(main(['--help'], io, fakeFiles({})), 0);
  assert.match(out.join(''), /woo-check/);
  assert.match(out.join(''), /Exit codes/);
});

test('the usage text documents every exit code the tool can return', () => {
  for (const code of ['0', '1', '2', '3', '64']) {
    assert.match(USAGE, new RegExp('\\n\\s+' + code + '\\s'), 'usage does not mention exit ' + code);
  }
});

test('a usage error prints to the error stream and returns the usage exit code', () => {
  const { io, out, err } = capture();
  assert.equal(main([], io, fakeFiles({})), USAGE_EXIT);
  assert.equal(out.length, 0);
  assert.match(err.join(''), /no paths given/);
});

test('listing the catalogue prints every finding in text form', () => {
  const { io, out } = capture();
  assert.equal(main(['--list'], io, fakeFiles({})), 0);
  const printed = out.join('');
  for (const entry of CATALOGUE) assert.ok(printed.includes(entry.id), 'missing ' + entry.id);
  assert.match(printed, new RegExp(CATALOGUE.length + ' findings'));
});

test('listing the catalogue as JSON is parseable and complete', () => {
  const { io, out } = capture();
  assert.equal(main(['--list', '--format', 'json'], io, fakeFiles({})), 0);
  const parsed = JSON.parse(out.join(''));
  assert.equal(parsed.findings.length, CATALOGUE.length);
  assert.ok(parsed.areas.length > 0);
});

test('a path that does not exist is a usage error naming the path', () => {
  const { io, err } = capture();
  assert.equal(main(['missing.html'], io, fakeFiles({})), USAGE_EXIT);
  assert.match(err.join(''), /missing\.html/);
});

test('a path holding nothing this tool reads is a usage error rather than a clean run', () => {
  const { io, err } = capture();
  const files = fakeFiles({ 'dir/notes.txt': 'hello' });
  assert.equal(main(['dir'], io, files), USAGE_EXIT);
  assert.match(err.join(''), /none of the paths/);
});

test('a clean file prints that there is nothing and exits zero', () => {
  const { io, out } = capture();
  const files = fakeFiles({ 'a.php': '<?php\n$a = 1;\n' });
  assert.equal(main(['a.php'], io, files), 0);
  assert.match(out.join(''), /No findings/);
});

test('a file with a critical finding exits three and names the finding', () => {
  const { io, out } = capture();
  const files = fakeFiles({ 'a.php': "<?php\n$r = $this->client->charge( $total );\n" });
  assert.equal(main(['a.php'], io, files), 3);
  assert.match(out.join(''), /charge-without-idempotency-key/);
  assert.match(out.join(''), /1 findings: 1 critical/);
});

test('the same file in JSON carries the id, the severity, the path and the line', () => {
  const { io, out } = capture();
  const files = fakeFiles({ 'a.php': "<?php\n$r = $this->client->charge( $total );\n" });
  assert.equal(main(['--format', 'json', 'a.php'], io, files), 3);
  const parsed = JSON.parse(out.join(''));
  assert.equal(parsed.total, 1);
  assert.equal(parsed.findings[0].id, 'charge-without-idempotency-key');
  assert.equal(parsed.findings[0].severity, 'critical');
  assert.equal(parsed.findings[0].path, 'a.php');
  assert.equal(parsed.findings[0].line, 2);
  assert.equal(parsed.counts.critical, 1);
});

test('the two output modes report the same findings for the same input', () => {
  const tree = {
    'dir/a.php': "<?php\n$r = $this->client->charge( $total );\n",
    'dir/b.html': '<form class="woocommerce-checkout" action="/c/" method="post">'
      + '<input id="x" name="x"><button type="submit">Place order</button></form>',
  };
  const textRun = capture();
  const jsonRun = capture();
  const textCode = main(['dir'], textRun.io, fakeFiles(tree));
  const jsonCode = main(['--format', 'json', 'dir'], jsonRun.io, fakeFiles(tree));
  assert.equal(textCode, jsonCode);
  const parsed = JSON.parse(jsonRun.out.join(''));
  for (const finding of parsed.findings) {
    assert.ok(textRun.out.join('').includes(finding.id), 'text output is missing ' + finding.id);
  }
  assert.match(textRun.out.join(''), new RegExp(parsed.total + ' findings'));
});

test('a directory is walked and files that cannot be read are skipped rather than failing', () => {
  const { io, out } = capture();
  const files = fakeFiles({
    'dir/a.php': "<?php\n$r = $this->client->charge( $total );\n",
    'dir/notes.txt': 'not read',
    'dir/sub/b.php': '<?php\n$a = 1;\n',
  });
  assert.equal(main(['dir'], io, files), 3);
  assert.match(out.join(''), /dir\/a\.php/);
  assert.equal(out.join('').includes('notes.txt'), false);
});

test('several paths are checked together and the worst severity decides the exit code', () => {
  const { io } = capture();
  const files = fakeFiles({
    'a.php': '<?php\n$total = floatval( $price );\n',
    'b.php': "<?php\n$r = $this->client->charge( $total );\n",
  });
  assert.equal(main(['a.php', 'b.php'], io, files), 3);
});

test('findings are grouped by path and printed in a stable order', () => {
  const { io, out } = capture();
  const files = fakeFiles({
    'b.php': '<?php\n$total = floatval( $price );\n',
    'a.php': "<?php\n$r = $this->client->charge( $total );\n",
  });
  main(['b.php', 'a.php'], io, files);
  const printed = out.join('');
  assert.ok(printed.indexOf('a.php') < printed.indexOf('b.php'), 'paths are not in order');
});
