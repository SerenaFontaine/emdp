/**
 * Parser for hard line breaks created by backslash-newline or trailing spaces.
 */

import type { HardbreakNode } from '../types.js';

export function parseHardBreak(text: string, pos: number): { node: HardbreakNode; length: number } | null {
  if (text[pos] === '\\' && text[pos + 1] === '\n') {
    return {
      node: { type: 'hardbreak' },
      length: 2,
    };
  }

  if (text[pos] === ' ') {
    let spaces = 0;
    let i = pos;
    while (i < text.length && text[i] === ' ') {
      spaces++;
      i++;
    }
    if (spaces >= 2 && text[i] === '\n') {
      return {
        node: { type: 'hardbreak' },
        length: spaces + 1,
      };
    }
  }

  return null;
}

export function isHardBreakStart(text: string, pos: number): boolean {
  if (text[pos] === '\\' && text[pos + 1] === '\n') return true;

  if (text[pos] === ' ') {
    let i = pos;
    let spaces = 0;
    while (i < text.length && text[i] === ' ') {
      spaces++;
      i++;
    }
    if (spaces >= 2 && text[i] === '\n') return true;
  }

  return false;
}
