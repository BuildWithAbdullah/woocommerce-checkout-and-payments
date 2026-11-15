// The filesystem adapter the command line tool is given. It takes its
// primitives as arguments rather than importing them, so a test can drive the
// directory walk over an invented tree without touching a disk, and so the
// entry point in bin/ has nothing in it but wiring.

export function makeFiles(primitives) {
  const { readFile, exists, isDirectory, readDirectory, join } = primitives;

  function walk(start) {
    if (!isDirectory(start)) return [start];
    const found = [];
    const pending = [start];
    while (pending.length) {
      const dir = pending.pop();
      for (const name of readDirectory(dir)) {
        if (name === '.git' || name === 'node_modules') continue;
        const full = join(dir, name);
        if (isDirectory(full)) pending.push(full);
        else found.push(full);
      }
    }
    return found.sort();
  }

  return { read: readFile, exists, walk };
}

export function nodePrimitives(fs, path) {
  return {
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    exists: (p) => fs.existsSync(p),
    isDirectory: (p) => fs.statSync(p).isDirectory(),
    readDirectory: (p) => fs.readdirSync(p),
    join: (a, b) => path.join(a, b),
  };
}
