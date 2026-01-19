/**
 * Parser for GFM task list items that recognize [ ] and [x] markers.
 */

import type { ListItemNode, ParagraphNode, InlineNode, TextNode } from '../types.js';

const TASK_LIST_MARKER = /^\[([ xX])\](?=\s)/;

export function parseTaskListMarker(text: string): { checked: boolean; length: number } | null {
  const match = text.match(TASK_LIST_MARKER);
  if (!match) return null;

  const char = match[1];
  const checked = char === 'x' || char === 'X';

  return {
    checked,
    length: 3,
  };
}

export function processTaskListItem(item: ListItemNode): void {
  if (item.children.length === 0) return;

  const firstChild = item.children[0];
  if (firstChild.type !== 'paragraph') return;

  const para = firstChild as ParagraphNode;

  const rawContent = (para as any).rawContent;
  if (typeof rawContent === 'string') {
    const result = parseTaskListMarker(rawContent);
    if (result) {
      item.checked = result.checked;
      (para as any).rawContent = rawContent.slice(result.length).replace(/^\s/, '');
    }
    return;
  }

  if (para.children && para.children.length > 0) {
    const firstInline = para.children[0];
    if (firstInline.type === 'text') {
      const textNode = firstInline as TextNode;
      const result = parseTaskListMarker(textNode.literal);
      if (result) {
        item.checked = result.checked;
        textNode.literal = textNode.literal.slice(result.length).replace(/^\s/, '');
        if (textNode.literal === '') {
          para.children.shift();
        }
      }
    }
  }
}

export function processTaskLists(blocks: any[]): void {
  for (const block of blocks) {
    if (block.type === 'list') {
      for (const item of block.children) {
        processTaskListItem(item);
        if (item.children) {
          processTaskLists(item.children);
        }
      }
    } else if (block.type === 'blockquote' && block.children) {
      processTaskLists(block.children);
    }
  }
}
