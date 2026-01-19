/**
 * Shared text-processing utilities for the parser, including entity decoding, escaping,
 * whitespace handling, and URI normalization.
 */

import { HTML_ENTITIES } from './entities.js';

export function decodeHtmlEntities(str: string): string {
  return str.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, capture) => {
    if (capture.startsWith('#x') || capture.startsWith('#X')) {
      const code = parseInt(capture.slice(2), 16);
      if (!isNaN(code) && code >= 0 && code <= 0x10ffff) {
        if (code === 0) return '\uFFFD';
        return String.fromCodePoint(code);
      }
    } else if (capture.startsWith('#')) {
      const code = parseInt(capture.slice(1), 10);
      if (!isNaN(code) && code >= 0 && code <= 0x10ffff) {
        if (code === 0) return '\uFFFD';
        return String.fromCodePoint(code);
      }
    } else if (HTML_ENTITIES[capture]) {
      return HTML_ENTITIES[capture];
    }
    return match;
  });
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeHtml(str: string, preserveEntities = false): string {
  if (preserveEntities) {
    return str
      .replace(/&(?![#a-zA-Z0-9]+;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  return escapeXml(str);
}

export const ASCII_PUNCTUATION_REGEX = /[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]/;
export const ASCII_PUNCTUATION_CHARS = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';

export function isAsciiPunctuation(char: string): boolean {
  return ASCII_PUNCTUATION_REGEX.test(char);
}

export function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

export function isUnicodeWhitespace(char: string): boolean {
  return /\s/.test(char);
}

export function isUnicodePunctuation(char: string): boolean {
  return /[\p{P}\p{S}]/u.test(char);
}

export function normalizeLineEndings(str: string): string {
  return str.replace(/\r\n?/g, '\n');
}

export function expandTabs(line: string, tabStop = 4): string {
  let result = '';
  let column = 0;
  for (const char of line) {
    if (char === '\t') {
      const spaces = tabStop - (column % tabStop);
      result += ' '.repeat(spaces);
      column += spaces;
    } else {
      result += char;
      column++;
    }
  }
  return result;
}

export function expandTabsPartial(line: string, startColumn: number, tabStop = 4): string {
  let result = '';
  let column = startColumn;
  for (const char of line) {
    if (char === '\t') {
      const spaces = tabStop - (column % tabStop);
      result += ' '.repeat(spaces);
      column += spaces;
    } else {
      result += char;
      column++;
    }
  }
  return result;
}

export function trimLeadingSpaces(line: string, max = 3): { trimmed: string; count: number } {
  let count = 0;
  let i = 0;
  while (i < line.length && line[i] === ' ' && count < max) {
    count++;
    i++;
  }
  return { trimmed: line.slice(i), count };
}

export function countLeadingSpaces(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === ' ') count++;
    else if (char === '\t') count += 4 - (count % 4);
    else break;
  }
  return count;
}

export function countLeadingChars(line: string): { spaces: number; chars: number } {
  let spaces = 0;
  let chars = 0;
  for (const char of line) {
    if (char === ' ') {
      spaces++;
      chars++;
    } else if (char === '\t') {
      const tabWidth = 4 - (spaces % 4);
      spaces += tabWidth;
      chars++;
    } else {
      break;
    }
  }
  return { spaces, chars };
}

export function removeIndent(line: string, indent: number): string {
  let removed = 0;
  let i = 0;
  while (i < line.length && removed < indent) {
    if (line[i] === ' ') {
      removed++;
      i++;
    } else if (line[i] === '\t') {
      const tabWidth = 4 - (removed % 4);
      if (removed + tabWidth <= indent) {
        removed += tabWidth;
        i++;
      } else {
        const remaining = indent - removed;
        const spacesFromTab = tabWidth - remaining;
        const originalColumn = removed + tabWidth;
        return ' '.repeat(spacesFromTab) + expandRestOfLine(line, i + 1, originalColumn);
      }
    } else {
      break;
    }
  }
  return line.slice(i);
}

function expandRestOfLine(line: string, startIdx: number, startColumn: number): string {
  let result = '';
  let column = startColumn;

  for (let i = startIdx; i < line.length; i++) {
    const char = line[i];
    if (char === '\t') {
      const tabWidth = 4 - (column % 4);
      result += ' '.repeat(tabWidth);
      column += tabWidth;
    } else {
      result += char;
      column++;
    }
  }
  return result;
}

export function extractContentAfterMarker(line: string, startColumn: number, charIndex: number): string {
  if (charIndex > 0 && line[charIndex - 1] === '\t') {
    let col = 0;
    let idx = 0;
    while (idx < charIndex - 1) {
      if (line[idx] === '\t') {
        col = col + (4 - (col % 4));
      } else {
        col++;
      }
      idx++;
    }
    const tabEndColumn = col + (4 - (col % 4));
    if (startColumn > col && startColumn < tabEndColumn) {
      const remainingSpaces = tabEndColumn - startColumn;
      return ' '.repeat(remainingSpaces) + line.slice(charIndex);
    }
  }
  return line.slice(charIndex);
}

export function normalizeUri(uri: string): string {
  try {
    let result = '';
    let i = 0;
    while (i < uri.length) {
      const char = uri[i];
      if (char === '%' && i + 2 < uri.length && /^[0-9a-fA-F]{2}$/.test(uri.slice(i + 1, i + 3))) {
        result += uri.slice(i, i + 3).toUpperCase();
        i += 3;
      } else {
        const code = char.charCodeAt(0);
        if (code > 0x7f || char === ' ') {
          result += encodeURIComponent(char);
        } else {
          result += char;
        }
        i++;
      }
    }
    return result;
  } catch {
    return uri;
  }
}

export function unescapeString(str: string): string {
  return str.replace(/\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/g, '$1');
}

export function normalizeLabel(label: string): string {
  return label
    .trim()
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/\u1e9e/g, 'ss')
    .toLowerCase();
}

const TAG_FILTER = new Set([
  'title',
  'textarea',
  'style',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'script',
  'plaintext',
]);

export function isTagFilterTag(tagName: string): boolean {
  return TAG_FILTER.has(tagName.toLowerCase());
}

export function applyTagFilter(html: string): string {
  return html.replace(
    /<(?=[ \t\n\r]*\/?[ \t\n\r]*(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)\b)/gi,
    '&lt;'
  );
}
