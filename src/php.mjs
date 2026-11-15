// Line oriented reading of PHP and JavaScript source, with comments removed.
//
// There is no AST here and there is deliberately no attempt at one. The
// checkers that read PHP are looking for named function calls, named hooks and
// named option values, all of which appear literally in the source of a real
// plugin or theme. What that costs is declared in src/limits.mjs: a call built
// from a variable function name is invisible, and so is one assembled by
// concatenation.
//
// The one thing this module does carefully is comment removal, because every
// assertion that scans source for a token will otherwise read the comment that
// explains the token and report the explanation as a breach. Comments are
// blanked rather than deleted, so every line number stays exactly where it was.

const SPACE = ' ';

function blank(out, from, to) {
  for (let k = from; k < to; k++) {
    if (out[k] !== '\n') out[k] = SPACE;
  }
}

// Replaces the body of every comment with spaces, keeping newlines and keeping
// the string the same length. String literals and heredocs are left intact, so
// a '//' inside a quoted URL is not treated as the start of a comment.
export function blankComments(source) {
  const src = String(source);
  const out = src.split('');
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];

    if (c === '\\' ) { i += 2; continue; }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) break;
        j++;
      }
      i = j + 1;
      continue;
    }

    if (c === '<' && src.startsWith('<<<', i)) {
      const m = /^<<<\s*(?:"([A-Za-z_][A-Za-z0-9_]*)"|'([A-Za-z_][A-Za-z0-9_]*)'|([A-Za-z_][A-Za-z0-9_]*))\r?\n/.exec(src.slice(i, i + 120));
      if (m) {
        const label = m[1] || m[2] || m[3];
        const bodyStart = i + m[0].length;
        const endRe = new RegExp('^[ \\t]*' + label + '\\b', 'm');
        const rest = src.slice(bodyStart);
        const found = endRe.exec(rest);
        i = found ? bodyStart + found.index + found[0].length : n;
        continue;
      }
    }

    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(out, i, stop);
      i = stop;
      continue;
    }

    if ((c === '/' && src[i + 1] === '/') || c === '#') {
      if (c === '#' && src[i + 1] === '[') { i += 2; continue; } // a PHP attribute
      let end = src.indexOf('\n', i);
      if (end < 0) end = n;
      blank(out, i, end);
      i = end;
      continue;
    }

    i++;
  }
  return out.join('');
}

// One entry per source line, numbered from 1, with comments already blanked.
export function codeLines(source) {
  const blanked = blankComments(source);
  return blanked.split(/\r?\n/).map((text, idx) => ({ no: idx + 1, text }));
}

// Finds every line whose blanked text matches the pattern. The pattern is
// tested per line, so a call split across two lines is matched on neither;
// that is one of the declared limits.
export function matchLines(source, pattern) {
  const re = pattern instanceof RegExp
    ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
    : new RegExp(String(pattern));
  const hits = [];
  for (const line of codeLines(source)) {
    const m = re.exec(line.text);
    if (m) hits.push({ no: line.no, text: line.text.trim(), match: m });
  }
  return hits;
}

export function hasLine(source, pattern) {
  return matchLines(source, pattern).length > 0;
}

export function firstLine(source, pattern) {
  const hits = matchLines(source, pattern);
  return hits.length ? hits[0].no : null;
}

// The blanked source as one string, for the handful of checks that genuinely
// span lines and say so.
export function codeText(source) {
  return blankComments(source);
}

// Returns the line number of the nearest preceding line matching `pattern`,
// or null. Used to attribute a finding to the call it sits inside rather than
// to the argument line.
export function enclosingLine(source, lineNo, pattern) {
  const lines = codeLines(source);
  const re = pattern instanceof RegExp ? pattern : new RegExp(String(pattern));
  for (let k = Math.min(lineNo, lines.length) - 1; k >= 0; k--) {
    if (re.test(lines[k].text)) return lines[k].no;
  }
  return null;
}
