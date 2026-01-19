/**
 * Parser for paragraph blocks as the default block type.
 */

import type { ParagraphNode } from '../types.js';

export function createParagraphNode(): ParagraphNode {
  return {
    type: 'paragraph',
    children: [],
  };
}

export function isParagraphContinuation(line: string): boolean {
  return line.trim() !== '';
}

export function trimParagraphLine(line: string): string {
  return line.replace(/^ {0,3}/, '').replace(/[ \t]+$/, '');
}
