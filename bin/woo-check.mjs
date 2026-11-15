#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { main } from '../src/cli.mjs';
import { makeFiles, nodePrimitives } from '../src/files.mjs';

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  process.exitCode = main(
    process.argv.slice(2),
    { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) },
    makeFiles(nodePrimitives(fs, path)),
  );
}
