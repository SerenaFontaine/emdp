/**
 * Parser for backslash escape sequences and escaped hard breaks.
 */

import { isAsciiPunctuation } from '../utils.js';

export function parseEscape(text: string, pos: number): { char: string; length: number } | null {
  if (text[pos] !== '\\') return null;
  if (pos + 1 >= text.length) return null;

  const nextChar = text[pos + 1];

  if (nextChar === '\n') {
    return { char: '\n', length: 2 };
  }

  if (isAsciiPunctuation(nextChar)) {
    return { char: nextChar, length: 2 };
  }

  return null;
}

export function isEscapedChar(text: string, pos: number): boolean {
  return parseEscape(text, pos) !== null;
}
