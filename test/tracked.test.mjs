import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseIgnore, isIgnored, listTracked, nodeTrackedPrimitives } from '../tools/tracked.mjs';

const rules = (text) => parseIgnore(text);

test('a blank line and a comment are not rules', () => {
  assert.equal(rules('\n# a comment\n   \n').length, 0);
});

test('a pattern with no slash matches at any depth', () => {
  const r = rules('*.log\n');
  assert.equal(isIgnored('a.log', r, false), true);
  assert.equal(isIgnored('deep/down/a.log', r, false), true);
  assert.equal(isIgnored('a.txt', r, false), false);
});

test('a pattern starting with a slash is anchored to the root', () => {
  const r = rules('/build\n');
  assert.equal(isIgnored('build', r, true), true);
  assert.equal(isIgnored('src/build', r, true), false);
});

test('a pattern with an inner slash is anchored too', () => {
  const r = rules('src/build\n');
  assert.equal(isIgnored('src/build', r, true), true);
  assert.equal(isIgnored('a/src/build', r, true), false);
});

test('a trailing slash makes a rule apply to directories only', () => {
  const r = rules('cache/\n');
  assert.equal(isIgnored('cache', r, true), true);
  assert.equal(isIgnored('cache', r, false), false);
});

test('a question mark matches exactly one character and never a slash', () => {
  const r = rules('a?.php\n');
  assert.equal(isIgnored('ab.php', r, false), true);
  assert.equal(isIgnored('abc.php', r, false), false);
});

test('a star does not cross a slash', () => {
  const r = rules('/src/*.php\n');
  assert.equal(isIgnored('src/a.php', r, false), true);
  assert.equal(isIgnored('src/sub/a.php', r, false), false);
});

test('a double star crosses slashes', () => {
  const r = rules('/src/**/a.php\n');
  assert.equal(isIgnored('src/a.php', r, false), true);
  assert.equal(isIgnored('src/sub/deeper/a.php', r, false), true);
});

test('the last matching rule wins, which is what makes a negation work', () => {
  const r = rules('*.log\n!keep.log\n');
  assert.equal(isIgnored('keep.log', r, false), false);
  assert.equal(isIgnored('drop.log', r, false), true);
});

test('a rule after a negation wins again', () => {
  const r = rules('*.log\n!keep.log\nkeep.log\n');
  assert.equal(isIgnored('keep.log', r, false), true);
});

test('a dot in a pattern is a literal dot and not any character', () => {
  const r = rules('a.php\n');
  assert.equal(isIgnored('a.php', r, false), true);
  assert.equal(isIgnored('axphp', r, false), false);
});

test('the matcher agrees with git on a tree built for the purpose', () => {
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (git.status !== 0) {
    assert.ok(true, 'git is not available, so there is nothing to compare against');
    return;
  }

  const root = mkdtempSync(join(tmpdir(), 'woo-tracked-'));
  try {
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'cache'));
    mkdirSync(join(root, 'cache', 'inner'));
    mkdirSync(join(root, 'logs'));
    writeFileSync(join(root, '.gitignore'), [
      'node_modules/',
      '*.log',
      '!logs/keep.log',
      'cache/',
      '!cache/inner/keep.txt',
      '/build',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'README.md'), 'x');
    writeFileSync(join(root, 'build'), 'x');
    writeFileSync(join(root, 'src', 'a.php'), 'x');
    writeFileSync(join(root, 'src', 'debug.log'), 'x');
    writeFileSync(join(root, 'logs', 'keep.log'), 'x');
    writeFileSync(join(root, 'logs', 'drop.log'), 'x');
    writeFileSync(join(root, 'cache', 'c.txt'), 'x');
    writeFileSync(join(root, 'cache', 'inner', 'keep.txt'), 'x');

    for (const args of [['init', '-q'], ['add', '-A'], ['-c', 'user.email=a@b.test', '-c', 'user.name=a', 'commit', '-qm', 'x']]) {
      const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      if (run.status !== 0 && args[0] === 'init') {
        assert.ok(true, 'git could not make a repository here');
        return;
      }
    }

    const listed = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
    const fromGit = listed.stdout.split('\n').filter(Boolean).sort();
    const fromUs = listTracked(root, nodeTrackedPrimitives(fs, path, root));

    assert.deepEqual(fromUs, fromGit);
    // The case that matters: a negation cannot reach inside an excluded
    // directory, so cache/inner/keep.txt is in neither list.
    assert.equal(fromGit.includes('cache/inner/keep.txt'), false);
    assert.equal(fromUs.includes('cache/inner/keep.txt'), false);
    // And a negation at the same level as its exclusion does work.
    assert.equal(fromUs.includes('logs/keep.log'), true);
    assert.equal(fromUs.includes('logs/drop.log'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('this repository has the files the matcher says it has', () => {
  const root = new URL('..', import.meta.url).pathname;
  const files = listTracked(root, nodeTrackedPrimitives(fs, path, root));
  assert.ok(files.includes('README.md'));
  assert.ok(files.includes('src/catalogue.mjs'));
  assert.equal(files.includes('package-lock.json'), false,
    'this repository deliberately tracks no lockfile, because it has no dependencies');
  assert.equal(files.some((f) => f.startsWith('node_modules/')), false);
});
