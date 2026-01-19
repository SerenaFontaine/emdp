/**
 * Text node factories for literal inline content.
 */

import type { TextNode } from '../types.js';

export function createTextNode(literal: string, noDelim = false): TextNode {
  return {
    type: 'text',
    literal,
    ...(noDelim ? { noDelim: true } : {}),
  };
}

export function mergeTextNodes(nodes: TextNode[]): TextNode {
  return {
    type: 'text',
    literal: nodes.map(n => n.literal).join(''),
  };
}
