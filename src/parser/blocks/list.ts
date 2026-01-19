/**
 * Parser for ordered and unordered lists with nesting and tight/loose detection.
 */

import type { ListNode, ListItemNode } from '../types.js';

const BULLET_LIST_REGEX = /^( {0,3})([-+*])( +|\t|$)/;
const ORDERED_LIST_REGEX = /^( {0,3})(\d{1,9})([.)])( +|\t|$)/;

export interface ListMarker {
  type: 'bullet' | 'ordered';
  indent: number;
  indentChars: number;
  marker: string;
  bulletChar?: '-' | '+' | '*';
  start?: number;
  delimiter?: '.' | ')';
  padding: number;
  paddingChars: number;
  contentIndent: number;
  contentCharIndex: number;
}

export function parseListMarker(line: string): ListMarker | null {
  const bulletMatch = line.match(BULLET_LIST_REGEX);
  if (bulletMatch) {
    const indentChars = bulletMatch[1].length;
    const indent = indentChars;
    const marker = bulletMatch[2];
    const spacesAfter = bulletMatch[3];
    let paddingChars = spacesAfter.length;

    const columnAfterMarker = indent + 1;
    let padding: number;
    if (spacesAfter === '\t') {
      padding = 4 - (columnAfterMarker % 4);
    } else if (spacesAfter === '') {
      padding = 1;
    } else {
      padding = spacesAfter.length;
    }

    let paddingToConsume = padding;
    if (spacesAfter === '\t') {
      paddingToConsume = 1;
      paddingChars = 1;
    } else if (padding >= 5) {
      paddingToConsume = 1;
      paddingChars = 1;
    }

    const contentIndent = indent + 1 + paddingToConsume;
    const contentCharIndex = indentChars + 1 + paddingChars;

    return {
      type: 'bullet',
      indent,
      indentChars,
      marker,
      bulletChar: marker as '-' | '+' | '*',
      padding: Math.min(paddingToConsume, 4),
      paddingChars,
      contentIndent,
      contentCharIndex,
    };
  }

  const orderedMatch = line.match(ORDERED_LIST_REGEX);
  if (orderedMatch) {
    const indentChars = orderedMatch[1].length;
    const indent = indentChars;
    const start = parseInt(orderedMatch[2], 10);
    const delimiter = orderedMatch[3] as '.' | ')';
    const marker = orderedMatch[2] + delimiter;
    const spacesAfter = orderedMatch[4];
    let paddingChars = spacesAfter.length;

    const columnAfterMarker = indent + marker.length;
    let padding: number;
    if (spacesAfter === '\t') {
      padding = 4 - (columnAfterMarker % 4);
    } else if (spacesAfter === '') {
      padding = 1;
    } else {
      padding = spacesAfter.length;
    }

    let paddingToConsume = padding;
    if (spacesAfter === '\t') {
      paddingToConsume = 1;
      paddingChars = 1;
    } else if (padding >= 5) {
      paddingToConsume = 1;
      paddingChars = 1;
    }

    const contentIndent = indent + marker.length + paddingToConsume;
    const contentCharIndex = indentChars + marker.length + paddingChars;

    return {
      type: 'ordered',
      indent,
      indentChars,
      marker,
      start,
      delimiter,
      padding: Math.min(paddingToConsume, 4),
      paddingChars,
      contentIndent,
      contentCharIndex,
    };
  }

  return null;
}

export function isListItemStart(line: string): boolean {
  return BULLET_LIST_REGEX.test(line) || ORDERED_LIST_REGEX.test(line);
}

export function isBulletListStart(line: string): boolean {
  return BULLET_LIST_REGEX.test(line);
}

export function isOrderedListStart(line: string): boolean {
  return ORDERED_LIST_REGEX.test(line);
}

export function canStartList(line: string, interruptingParagraph: boolean): boolean {
  if (!interruptingParagraph) return isListItemStart(line);

  const marker = parseListMarker(line);
  if (!marker) return false;

  if (marker.type === 'ordered' && marker.start !== 1) {
    return false;
  }

  const content = line.slice(marker.indent + marker.marker.length + marker.padding);
  if (content.trim() === '') {
    return false;
  }

  return true;
}

export function createListNode(marker: ListMarker): ListNode {
  return {
    type: 'list',
    listType: marker.type,
    start: marker.start ?? 1,
    tight: true,
    delimiter: marker.delimiter ?? null,
    bulletChar: marker.bulletChar ?? null,
    children: [],
  };
}

export function createListItemNode(): ListItemNode {
  return {
    type: 'list_item',
    children: [],
  };
}

export function listsMatch(a: ListMarker, b: ListMarker): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'bullet' && b.type === 'bullet') {
    return a.bulletChar === b.bulletChar;
  }
  if (a.type === 'ordered' && b.type === 'ordered') {
    return a.delimiter === b.delimiter;
  }
  return false;
}
