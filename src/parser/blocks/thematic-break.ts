/**
 * Parser for thematic breaks (horizontal rules).
 */

import type { ThematicBreakNode } from '../types.js';

const THEMATIC_BREAK_REGEX = /^( {0,3})([-*_])(?:[ \t]*\2){2,}[ \t]*$/;

export function parseThematicBreak(line: string): ThematicBreakNode | null {
  if (THEMATIC_BREAK_REGEX.test(line)) {
    return { type: 'thematic_break' };
  }
  return null;
}

export function isThematicBreak(line: string): boolean {
  return THEMATIC_BREAK_REGEX.test(line);
}
