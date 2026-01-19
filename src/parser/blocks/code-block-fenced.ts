/**
 * Parser for fenced code blocks with optional info strings.
 */

import type { CodeBlockNode } from '../types.js';

const BACKTICK_FENCE_OPEN_REGEX = /^( {0,3})(`{3,})([^`]*)$/;
const TILDE_FENCE_OPEN_REGEX = /^( {0,3})(~{3,})(.*)$/;

export interface FenceInfo {
  indent: number;
  char: '`' | '~';
  length: number;
  info: string;
}

export function parseFenceOpen(line: string): FenceInfo | null {
  let match = line.match(BACKTICK_FENCE_OPEN_REGEX);
  if (!match) {
    match = line.match(TILDE_FENCE_OPEN_REGEX);
  }
  if (!match) return null;

  const indent = match[1].length;
  const fence = match[2];
  const char = fence[0] as '`' | '~';
  const length = fence.length;
  const info = match[3].trim();

  return { indent, char, length, info };
}

export function isFenceClose(line: string, fence: FenceInfo): boolean {
  const trimmed = line.replace(/^( {0,3})/, '');
  const closeRegex = new RegExp(`^${fence.char}{${fence.length},}[ \\t]*$`);
  return closeRegex.test(trimmed);
}

export function isFencedCodeStart(line: string): boolean {
  return BACKTICK_FENCE_OPEN_REGEX.test(line) || TILDE_FENCE_OPEN_REGEX.test(line);
}

export function createFencedCodeBlock(info: string, lines: string[], indent: number): CodeBlockNode {
  const content = lines
    .map(line => {
      let removed = 0;
      let i = 0;
      while (i < line.length && removed < indent) {
        if (line[i] === ' ') {
          removed++;
          i++;
        } else {
          break;
        }
      }
      return line.slice(i);
    })
    .join('\n');

  const hasContent = lines.length > 0 && (lines.length > 1 || lines[0] !== '');
  return {
    type: 'code_block',
    info,
    literal: hasContent ? content + '\n' : '',
    fenced: true,
  };
}
