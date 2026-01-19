/**
 * Parser for inline code spans delimited by backticks.
 */

import type { CodeSpanNode } from '../types.js';

export function parseCodeSpan(text: string, pos: number): { node: CodeSpanNode; length: number } | null {
  if (text[pos] !== '`') return null;

  let openingLength = 0;
  let i = pos;
  while (i < text.length && text[i] === '`') {
    openingLength++;
    i++;
  }

  let searchPos = i;
  while (searchPos < text.length) {
    const nextBacktick = text.indexOf('`', searchPos);
    if (nextBacktick === -1) return null;

    let closingLength = 0;
    let j = nextBacktick;
    while (j < text.length && text[j] === '`') {
      closingLength++;
      j++;
    }

    if (closingLength === openingLength) {
      let content = text.slice(i, nextBacktick);

      content = content.replace(/\n/g, ' ');

      if (content.length >= 2 && content[0] === ' ' && content[content.length - 1] === ' ' && content.trim() !== '') {
        content = content.slice(1, -1);
      }

      return {
        node: {
          type: 'code_span',
          literal: content,
        },
        length: j - pos,
      };
    }

    searchPos = j;
  }

  return null;
}

export function isCodeSpanStart(text: string, pos: number): boolean {
  return text[pos] === '`';
}
