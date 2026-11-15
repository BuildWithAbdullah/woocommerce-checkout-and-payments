import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { makeFiles, nodePrimitives } from '../src/files.mjs';

function invented(tree) {
  return makeFiles({
    readFile: (p) => tree[p],
    exists: (p) => p in tree,
    isDirectory: (p) => !(p in tree),
    readDirectory: (p) => {
      const prefix = p + '/';
      const names = new Set();
      for (const key of Object.keys(tree)) {
        if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split('/')[0]);
      }
      return [...names];
    },
    join: (a, b) => a + '/' + b,
  });
}

test('a single file walks to itself', () => {
  const files = invented({ 'a/b.php': 'x' });
  assert.deepEqual(files.walk('a/b.php'), ['a/b.php']);
});

test('a directory walks to every file beneath it, sorted', () => {
  const files = invented({ 'r/b.php': '', 'r/a.php': '', 'r/sub/c.php': '' });
  assert.deepEqual(files.walk('r'), ['r/a.php', 'r/b.php', 'r/sub/c.php']);
});

test('a git directory and a node modules directory are never walked into', () => {
  const files = invented({ 'r/a.php': '', 'r/.git/config': '', 'r/node_modules/x/index.js': '' });
  assert.deepEqual(files.walk('r'), ['r/a.php']);
});

test('reading and existence are handed straight through', () => {
  const files = invented({ 'a.php': 'contents' });
  assert.equal(files.read('a.php'), 'contents');
  assert.equal(files.exists('a.php'), true);
  assert.equal(files.exists('b.php'), false);
});

test('the node primitives walk a real tree on disk', () => {
  const root = mkdtempSync(join(tmpdir(), 'woo-files-'));
  try {
    mkdirSync(join(root, 'sub'));
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'a.php'), '<?php\n');
    writeFileSync(join(root, 'sub', 'b.html'), '<p></p>');
    writeFileSync(join(root, 'node_modules', 'c.php'), '<?php\n');
    const files = makeFiles(nodePrimitives(fs, path));
    const found = files.walk(root).map((p) => p.slice(root.length + 1));
    assert.deepEqual(found, ['a.php', 'sub/b.html']);
    assert.equal(files.read(join(root, 'a.php')), '<?php\n');
    assert.equal(files.exists(join(root, 'a.php')), true);
    assert.equal(files.exists(join(root, 'nope')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a deep tree is walked without recursing on the call stack', () => {
  const tree = {};
  let prefix = 'r';
  for (let depth = 0; depth < 200; depth += 1) {
    prefix += '/d';
    tree[prefix + '/f.php'] = '';
  }
  const files = invented(tree);
  assert.equal(files.walk('r').length, 200);
});
