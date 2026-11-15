// A small, dependency free HTML scanner.
//
// It is not a browser and it is not a full HTML5 parser. What it gives you is
// a flat list of elements in source order, each with its lowercased tag name,
// its attributes, the line it opened on, and the offsets of its open tag and
// its closing tag when one was found. That is enough for every structural and
// attribute question the checkers in this repository ask, and the things it
// cannot answer are declared in src/limits.mjs rather than guessed at.
//
// Deliberate choices, each of which a real parser would make differently:
//
//   - Raw text elements (script, style, textarea, title) are skipped whole, so
//     markup written inside a script is not mistaken for markup.
//   - A handful of tags close an open sibling implicitly (li, p, td, tr, dt,
//     dd, option), because checkout templates rely on that and a naive stack
//     would nest a whole list inside its first item.
//   - An unmatched closing tag pops to the nearest matching open element and
//     is otherwise ignored. It never throws.
//   - Attribute values are decoded for the five named entities and for numeric
//     references. Anything else is left alone.

const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

// Opening one of these closes any of the listed tags that is currently open.
const IMPLICIT_CLOSE = {
  li: ['li'],
  p: ['p'],
  option: ['option'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  tr: ['tr'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
};

function countNewlines(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

function parseAttrs(source) {
  const attrs = {};
  const re = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const name = m[1].toLowerCase();
    if (name === '/') continue;
    const raw = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    if (!(name in attrs)) attrs[name] = decodeEntities(raw);
  }
  return attrs;
}

export function parseElements(html) {
  const text = String(html);
  const n = text.length;
  const elements = [];
  const stack = [];
  let i = 0;
  let line = 1;

  const advance = (to) => {
    line += countNewlines(text.slice(i, to));
    i = to;
  };

  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    advance(lt);

    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      advance(end < 0 ? n : end + 3);
      continue;
    }
    if (text.startsWith('<!', i) || text.startsWith('<?', i)) {
      const end = text.indexOf('>', i);
      advance(end < 0 ? n : end + 1);
      continue;
    }
    if (text.startsWith('</', i)) {
      const end = text.indexOf('>', i);
      const name = text.slice(i + 2, end < 0 ? n : end).trim().toLowerCase();
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].tag === name) {
          for (let k = stack.length - 1; k >= s; k--) stack[k].close = i;
          stack.length = s;
          break;
        }
      }
      advance(end < 0 ? n : end + 1);
      continue;
    }

    const head = /^<([a-zA-Z][a-zA-Z0-9:_-]*)/.exec(text.slice(i, i + 80));
    if (!head) {
      advance(i + 1);
      continue;
    }
    const tag = head[1].toLowerCase();

    // Walk to the end of the open tag without being fooled by a '>' inside an
    // attribute value.
    let j = i + head[0].length;
    let quote = null;
    while (j < n) {
      const c = text[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        break;
      }
      j++;
    }
    const openEnd = Math.min(j + 1, n);
    const inner = text.slice(i + head[0].length, j);
    const selfClosed = /\/\s*$/.test(inner) || VOID.has(tag);

    const closes = IMPLICIT_CLOSE[tag];
    if (closes) {
      const top = stack[stack.length - 1];
      if (top && closes.includes(top.tag)) {
        top.close = i;
        stack.pop();
      }
    }

    const el = {
      index: elements.length,
      tag,
      attrs: parseAttrs(inner),
      line,
      open: i,
      openEnd,
      close: selfClosed ? openEnd : null,
      parent: stack.length ? stack[stack.length - 1].index : null,
      ancestors: stack.map((s) => s.index),
    };
    elements.push(el);

    if (RAW_TEXT.has(tag) && !selfClosed) {
      const needle = '</' + tag;
      const found = text.toLowerCase().indexOf(needle, openEnd);
      el.close = found < 0 ? n : found;
      const after = found < 0 ? n : Math.min(text.indexOf('>', found) + 1 || n, n);
      advance(after);
      continue;
    }

    advance(openEnd);
    if (!selfClosed) stack.push(el);
  }

  for (const el of stack) if (el.close === null) el.close = n;
  for (const el of elements) if (el.close === null) el.close = el.openEnd;

  return elements;
}

export function innerHtml(source, el) {
  return String(source).slice(el.openEnd, el.close);
}

// An image contributes its alternative text to the text of whatever contains
// it, which is how a label made of nothing but a brand logo gets a name. An
// earlier version stripped the img tag like any other and reported such a
// label as empty, which is a false positive on markup a browser reads
// perfectly well.
function expandAlternatives(markup) {
  return markup.replace(/<(?:img|area|input)\b[^>]*>/gi, (tag) => {
    const found = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
    const alt = found ? (found[1] !== undefined ? found[1] : found[2] !== undefined ? found[2] : found[3]) : '';
    return ' ' + alt + ' ';
  });
}

export function innerText(source, el) {
  return expandAlternatives(innerHtml(source, el)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' '))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function textOf(source, el) {
  return decodeEntities(innerText(source, el));
}

export function attr(el, name) {
  const v = el.attrs[String(name).toLowerCase()];
  return v === undefined ? null : v;
}

export function hasAttr(el, name) {
  return Object.prototype.hasOwnProperty.call(el.attrs, String(name).toLowerCase());
}

export function tokens(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

export function byTag(elements, ...names) {
  const want = new Set(names.map((s) => s.toLowerCase()));
  return elements.filter((el) => want.has(el.tag));
}

export function idMap(elements) {
  const map = new Map();
  for (const el of elements) {
    const id = attr(el, 'id');
    if (id && !map.has(id)) map.set(id, el);
  }
  return map;
}
