/**
 * Parser for ATX headings using leading # markers.
 */

import type { HeadingNode } from '../types.js';

const ATX_HEADING_REGEX = /^( {0,3})(#{1,6})([ \t].*|[ \t]*)$/;

export function parseAtxHeading(line: string): { level: 1 | 2 | 3 | 4 | 5 | 6; content: string } | null {
  const match = line.match(ATX_HEADING_REGEX);
  if (!match) return null;

  const level = match[2].length as 1 | 2 | 3 | 4 | 5 | 6;
  let content = match[3];

  content = content.replace(/[ \t]+#+[ \t]*$/, '');
  content = content.trim();

  return { level, content };
}

export function isAtxHeading(line: string): boolean {
  return ATX_HEADING_REGEX.test(line);
}

export function createHeadingNode(level: 1 | 2 | 3 | 4 | 5 | 6): HeadingNode {
  return {
    type: 'heading',
    level,
    children: [],
  };
}
