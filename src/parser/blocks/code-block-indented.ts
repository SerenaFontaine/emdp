/**
 * Parser for indented code blocks.
 */

import type { CodeBlockNode } from '../types.js';
import { countLeadingSpaces } from '../utils.js';

export function isIndentedCodeLine(line: string): boolean {
  if (line.trim() === '') return false;
  return countLeadingSpaces(line) >= 4;
}

export function removeIndentation(line: string, amount = 4): string {
  let removed = 0;
  let i = 0;
  while (i < line.length && removed < amount) {
    if (line[i] === ' ') {
      removed++;
      i++;
    } else if (line[i] === '\t') {
      const tabWidth = 4 - (removed % 4);
      if (removed + tabWidth <= amount) {
        removed += tabWidth;
        i++;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return line.slice(i);
}

export function createIndentedCodeBlock(lines: string[]): CodeBlockNode {
  const content = lines.join('\n');
  return {
    type: 'code_block',
    info: '',
    literal: content + '\n',
    fenced: false,
  };
}
