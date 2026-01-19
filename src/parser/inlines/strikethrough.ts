/**
 * Parser for GFM strikethrough using ~ delimiters.
 */

import type { StrikethroughNode, InlineNode } from '../types.js';

export interface StrikethroughDelimiter {
  char: '~';
  length: number;
  canOpen: boolean;
  canClose: boolean;
  position: number;
  origLength: number;
}

export function parseStrikethroughDelimiter(text: string, pos: number): StrikethroughDelimiter | null {
  if (text[pos] !== '~') return null;

  let length = 0;
  let i = pos;
  while (i < text.length && text[i] === '~') {
    length++;
    i++;
  }

  if (length > 2) return null;

  const charBefore = pos > 0 ? text[pos - 1] : '\n';
  const charAfter = i < text.length ? text[i] : '\n';

  const isWhitespace = (c: string): boolean => /\s/.test(c) || c === '\n';

  const beforeIsWhitespace = isWhitespace(charBefore);
  const afterIsWhitespace = isWhitespace(charAfter);

  const canOpen = !afterIsWhitespace;
  const canClose = !beforeIsWhitespace;

  return {
    char: '~',
    length,
    canOpen,
    canClose,
    position: pos,
    origLength: length,
  };
}

export function isStrikethroughDelimiter(text: string, pos: number): boolean {
  return text[pos] === '~';
}

export function createStrikethroughNode(children: InlineNode[] = []): StrikethroughNode {
  return {
    type: 'strikethrough',
    children,
  };
}

export function canStrikethroughDelimitersMatch(opener: StrikethroughDelimiter, closer: StrikethroughDelimiter): boolean {
  return opener.length === closer.length;
}
