/**
 * Parser for soft line breaks created by single newlines.
 */

import type { SoftbreakNode } from '../types.js';

export function parseSoftBreak(text: string, pos: number): { node: SoftbreakNode; length: number } | null {
  if (text[pos] !== '\n') return null;

  return {
    node: { type: 'softbreak' },
    length: 1,
  };
}

export function isSoftBreak(text: string, pos: number): boolean {
  return text[pos] === '\n';
}
