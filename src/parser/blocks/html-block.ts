/**
 * Parser for raw HTML blocks defined by the CommonMark spec.
 */

import type { HtmlBlockNode } from '../types.js';

const TYPE_6_TAGS = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul'
]);

export type HtmlBlockType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;

const TYPE_1_OPEN_REGEX = /^<(?:pre|script|style|textarea)(?:\s|>|$)/i;
const TYPE_1_CLOSE_REGEX = /<\/(?:pre|script|style|textarea)>/i;

const TYPE_2_OPEN_REGEX = /^<!--/;
const TYPE_2_CLOSE_REGEX = /-->/;

const TYPE_3_OPEN_REGEX = /^<\?/;
const TYPE_3_CLOSE_REGEX = /\?>/;

const TYPE_4_OPEN_REGEX = /^<![a-zA-Z]/;
const TYPE_4_CLOSE_REGEX = />/;

const TYPE_5_OPEN_REGEX = /^<!\[CDATA\[/i;
const TYPE_5_CLOSE_REGEX = /\]\]>/;

const TYPE_6_OPEN_REGEX = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)(?:\s|\/?>|$)/i;

const TYPE_7_OPEN_TAG_REGEX = /^<([a-zA-Z][a-zA-Z0-9-]*)(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>\s*$/i;
const TYPE_7_CLOSE_TAG_REGEX = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>\s*$/i;

export function getHtmlBlockType(line: string, canInterruptParagraph: boolean): HtmlBlockType {
  const trimmed = line.replace(/^ {0,3}/, '');

  if (TYPE_1_OPEN_REGEX.test(trimmed)) return 1;
  if (TYPE_2_OPEN_REGEX.test(trimmed)) return 2;
  if (TYPE_3_OPEN_REGEX.test(trimmed)) return 3;
  if (TYPE_4_OPEN_REGEX.test(trimmed)) return 4;
  if (TYPE_5_OPEN_REGEX.test(trimmed)) return 5;

  const type6Match = trimmed.match(TYPE_6_OPEN_REGEX);
  if (type6Match && TYPE_6_TAGS.has(type6Match[1].toLowerCase())) {
    return 6;
  }

  if (canInterruptParagraph) {
    if (TYPE_7_OPEN_TAG_REGEX.test(trimmed) || TYPE_7_CLOSE_TAG_REGEX.test(trimmed)) {
      return 7;
    }
  }

  return null;
}

export function isHtmlBlockClose(line: string, type: HtmlBlockType): boolean {
  switch (type) {
    case 1:
      return TYPE_1_CLOSE_REGEX.test(line);
    case 2:
      return TYPE_2_CLOSE_REGEX.test(line);
    case 3:
      return TYPE_3_CLOSE_REGEX.test(line);
    case 4:
      return TYPE_4_CLOSE_REGEX.test(line);
    case 5:
      return TYPE_5_CLOSE_REGEX.test(line);
    case 6:
    case 7:
      return line.trim() === '';
    default:
      return false;
  }
}

export function isHtmlBlockStart(line: string, canInterruptParagraph = true): boolean {
  return getHtmlBlockType(line, canInterruptParagraph) !== null;
}

export function createHtmlBlockNode(content: string): HtmlBlockNode {
  return {
    type: 'html_block',
    literal: content,
  };
}
