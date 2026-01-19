/**
 * Parser for blockquote elements prefixed with >.
 */

import type { BlockquoteNode } from '../types.js';

const BLOCKQUOTE_REGEX = /^( {0,3})>( ?)/;

export function isBlockquoteStart(line: string): boolean {
  return BLOCKQUOTE_REGEX.test(line);
}

export function removeBlockquotePrefix(line: string): string {
  return line.replace(BLOCKQUOTE_REGEX, '');
}

export function createBlockquoteNode(): BlockquoteNode {
  return {
    type: 'blockquote',
    children: [],
  };
}

export function getBlockquoteContent(line: string): string | null {
  const match = line.match(BLOCKQUOTE_REGEX);
  if (!match) return null;
  return line.slice(match[0].length);
}
