/**
 * Parser for inline links and images, including destinations, titles, and reference labels.
 */

import type { LinkNode, ImageNode, LinkReferenceDefinition } from '../types.js';
import { normalizeLabel, unescapeString, decodeHtmlEntities } from '../utils.js';

export interface LinkMatch {
  type: 'link' | 'image';
  destination: string;
  title: string;
  textStart: number;
  textEnd: number;
  fullEnd: number;
}

const LINK_DESTINATION_ANGLE_REGEX = /^<([^<>\n\\]|\\.)*>/;
const LINK_DESTINATION_BARE_REGEX = /^[^\s\x00-\x1f]*?(?:\([^\s\x00-\x1f]*?\)[^\s\x00-\x1f]*?)*[^\s\x00-\x1f)]/;
const LINK_TITLE_REGEX = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\(([^()\\]*(?:\\.[^()\\]*)*)\))/;

export function parseLinkDestination(text: string): { destination: string; length: number } | null {
  if (text[0] === '<') {
    const match = text.match(LINK_DESTINATION_ANGLE_REGEX);
    if (match) {
      return {
        destination: decodeHtmlEntities(unescapeString(match[0].slice(1, -1))),
        length: match[0].length,
      };
    }
    return null;
  }

  let parenDepth = 0;
  let i = 0;
  while (i < text.length) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length) {
      const nextChar = text[i + 1];
      if (nextChar === ' ' || nextChar === '\t' || nextChar === '\n' || nextChar === '\r') {
        return null;
      }
      i += 2;
      continue;
    }

    if (char === '(') {
      parenDepth++;
    } else if (char === ')') {
      if (parenDepth === 0) break;
      parenDepth--;
    } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char.charCodeAt(0) < 0x20) {
      break;
    }

    i++;
  }

  if (i === 0) return null;

  return {
    destination: decodeHtmlEntities(unescapeString(text.slice(0, i))),
    length: i,
  };
}

export function parseLinkTitle(text: string): { title: string; length: number } | null {
  const match = text.match(LINK_TITLE_REGEX);
  if (!match) return null;

  const title = match[1] ?? match[2] ?? match[3] ?? '';
  return {
    title: decodeHtmlEntities(unescapeString(title)),
    length: match[0].length,
  };
}

export function parseInlineLink(text: string, pos: number): { destination: string; title: string; length: number } | null {
  if (text[pos] !== '(') return null;

  let i = pos + 1;

  while (i < text.length && /[ \t\n]/.test(text[i])) i++;

  if (text[i] === ')') {
    return { destination: '', title: '', length: i - pos + 1 };
  }

  const destResult = parseLinkDestination(text.slice(i));
  if (!destResult) return null;

  const destination = destResult.destination;
  i += destResult.length;

  while (i < text.length && /[ \t]/.test(text[i])) i++;

  let title = '';
  if (text[i] === '\n') {
    i++;
    while (i < text.length && /[ \t]/.test(text[i])) i++;
  }

  if (text[i] === '"' || text[i] === "'" || text[i] === '(') {
    const titleResult = parseLinkTitle(text.slice(i));
    if (titleResult) {
      title = titleResult.title;
      i += titleResult.length;
    }
  }

  while (i < text.length && /[ \t\n]/.test(text[i])) i++;

  if (text[i] !== ')') return null;

  return { destination, title, length: i - pos + 1 };
}

export function parseLinkLabel(text: string, pos: number): { label: string; length: number } | null {
  if (text[pos] !== '[') return null;

  let i = pos + 1;
  let depth = 1;
  let label = '';

  while (i < text.length && depth > 0) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === '[' || next === ']' || next === '\\') {
        label += next;
        i += 2;
        continue;
      }
      label += '\\';
      i++;
      continue;
    }

    if (char === '[') {
      return null;
    }

    if (char === ']') {
      depth--;
      if (depth === 0) break;
    }

    label += char;
    i++;
  }

  if (depth !== 0) return null;
  if (label.length > 999) return null;

  if (label.trim() === '') {
    return { label: '', length: i - pos + 1 };
  }

  return { label: normalizeLabel(label), length: i - pos + 1 };
}

export function createLinkNode(destination: string, title: string): LinkNode {
  return {
    type: 'link',
    destination,
    title,
    children: [],
  };
}

export function createImageNode(destination: string, title: string, alt: string): ImageNode {
  return {
    type: 'image',
    destination,
    title,
    alt,
  };
}

export function isLinkStart(text: string, pos: number): boolean {
  return text[pos] === '[';
}

export function isImageStart(text: string, pos: number): boolean {
  return text[pos] === '!' && text[pos + 1] === '[';
}
