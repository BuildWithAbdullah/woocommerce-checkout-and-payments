// A gitignore matcher, because any assertion that counts the files in this
// repository has to count the files git counts.
//
// Three properties that are easy to get wrong and are all tested:
//
//   - Last match wins. A later rule overrides an earlier one, which is what
//     makes negation work at all.
//   - A negation cannot re-include a file inside an excluded directory. Git
//     never looks inside a directory it has excluded, so `!a/b/keep.txt` does
//     nothing when `a/` is ignored. This is the case a naive implementation
//     gets wrong, and it gets it wrong in the direction of counting files git
//     does not have.
//   - A pattern with no slash matches at any depth; a pattern with a slash is
//     anchored to the root of the repository.
//
// test/tracked.test.mjs builds a tree on disk and compares the answer against
// `git ls-files`, so this is checked against git rather than against an
// opinion about git.

function escapeRegex(text) {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

function toRegex(pattern, anchored) {
  let source = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 3;
      continue;
    }
    if (pattern.startsWith('/**', i)) {
      source += '(?:/.*)?';
      i += 3;
      continue;
    }
    if (pattern.startsWith('**', i)) {
      source += '.*';
      i += 2;
      continue;
    }
    const c = pattern[i];
    if (c === '*') { source += '[^/]*'; i += 1; continue; }
    if (c === '?') { source += '[^/]'; i += 1; continue; }
    source += escapeRegex(c);
    i += 1;
  }
  const head = anchored ? '^' : '^(?:.*/)?';
  return new RegExp(head + source + '$');
}

export function parseIgnore(text) {
  const rules = [];
  for (const raw of String(text).split(/\r?\n/)) {
    let line = raw;
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    let negated = false;
    if (line.startsWith('!')) { negated = true; line = line.slice(1); }
    line = line.replace(/\s+$/, '');
    if (!line) continue;
    let directoryOnly = false;
    if (line.endsWith('/')) { directoryOnly = true; line = line.slice(0, -1); }
    let anchored = false;
    if (line.startsWith('/')) { anchored = true; line = line.slice(1); }
    else if (line.slice(0, -1).includes('/')) anchored = true;
    if (!line) continue;
    rules.push({ pattern: line, negated, directoryOnly, re: toRegex(line, anchored) });
  }
  return rules;
}

// Returns true when git would ignore this path. `isDirectory` decides whether
// a directory-only rule applies.
export function isIgnored(relativePath, rules, isDirectory) {
  let ignored = false;
  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) continue;
    if (!rule.re.test(relativePath)) continue;
    ignored = !rule.negated;
  }
  return ignored;
}

// Walks a tree the way git does: an ignored directory is not descended into,
// so nothing inside it can be re-included.
export function listTracked(root, primitives) {
  const { readDirectory, isDirectory, join } = primitives;
  const rules = parseIgnore(primitives.readIgnore());
  const found = [];

  const walk = (relative) => {
    const absolute = relative ? join(root, relative) : root;
    for (const name of readDirectory(absolute)) {
      if (name === '.git') continue;
      const childRelative = relative ? relative + '/' + name : name;
      const childAbsolute = join(root, childRelative);
      const directory = isDirectory(childAbsolute);
      if (isIgnored(childRelative, rules, directory)) continue;
      if (directory) walk(childRelative);
      else found.push(childRelative);
    }
  };

  walk('');
  return found.sort();
}

export function nodeTrackedPrimitives(fs, path, root) {
  return {
    readDirectory: (p) => fs.readdirSync(p),
    isDirectory: (p) => fs.statSync(p).isDirectory(),
    join: (a, b) => path.join(a, b),
    readIgnore: () => {
      try {
        return fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
      } catch {
        return '';
      }
    },
  };
}
