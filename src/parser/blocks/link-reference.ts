/**
 * Parser for link reference definitions used by reference-style links.
 */

import type { LinkReferenceDefinition } from '../types.js';
import { normalizeLabel, unescapeString, decodeHtmlEntities } from '../utils.js';

const LINK_LABEL_REGEX = /^\[((?:[^\[\]\\]|\\.){0,999})\]/;
const LINK_DESTINATION_ANGLE_REGEX = /^<([^<>\n\\]|\\.)*>/;
const LINK_DESTINATION_BARE_REGEX = /^[^\s<\[\]]*(?:\([^\s<\[\]]*\)[^\s<\[\]]*)*[^\s<\[\]]*/;
const LINK_TITLE_DOUBLE_REGEX = /^"((?:[^"\\]|\\[\s\S])*)"/;
const LINK_TITLE_SINGLE_REGEX = /^'((?:[^'\\]|\\[\s\S])*)'/;
const LINK_TITLE_PAREN_REGEX = /^\(((?:[^()\\]|\\[\s\S])*)\)/;

export interface LinkRefResult {
  label: string;
  definition: LinkReferenceDefinition;
  consumed: number;
}

export function parseLinkReferenceDefinition(text: string): LinkRefResult | null {
  let pos = 0;

  const indentMatch = text.match(/^( {0,3})/);
  if (indentMatch) pos += indentMatch[1].length;

  const labelMatch = text.slice(pos).match(LINK_LABEL_REGEX);
  if (!labelMatch) return null;

  const rawLabel = labelMatch[1];
  if (rawLabel.trim() === '') return null;

  pos += labelMatch[0].length;

  if (text[pos] !== ':') return null;
  pos++;

  const beforeDest = text.slice(pos).match(/^[ \t]*\n?[ \t]*/);
  if (beforeDest) pos += beforeDest[0].length;

  let destination: string;
  const angleMatch = text.slice(pos).match(LINK_DESTINATION_ANGLE_REGEX);
  if (angleMatch) {
    destination = angleMatch[0].slice(1, -1);
    pos += angleMatch[0].length;
  } else {
    const bareMatch = text.slice(pos).match(LINK_DESTINATION_BARE_REGEX);
    if (!bareMatch || bareMatch[0] === '') return null;
    destination = bareMatch[0];
    pos += bareMatch[0].length;
  }

  let title = '';
  let titleFound = false;

  const tryMatchTitle = (titlePos: number): { title: string; endPos: number } | null => {
    const remaining = text.slice(titlePos);
    const doubleMatch = remaining.match(LINK_TITLE_DOUBLE_REGEX);
    const singleMatch = remaining.match(LINK_TITLE_SINGLE_REGEX);
    const parenMatch = remaining.match(LINK_TITLE_PAREN_REGEX);

    const titleMatch = doubleMatch || singleMatch || parenMatch;
    if (titleMatch) {
      const afterTitlePos = titlePos + titleMatch[0].length;
      const afterTitle = text.slice(afterTitlePos).match(/^[ \t]*(?:\n|$)/);
      if (afterTitle) {
        return { title: titleMatch[1], endPos: afterTitlePos + afterTitle[0].length };
      }
    }
    return null;
  };

  const spaceBeforeTitle = text.slice(pos).match(/^[ \t]+/);
  if (spaceBeforeTitle) {
    const result = tryMatchTitle(pos + spaceBeforeTitle[0].length);
    if (result) {
      title = result.title;
      pos = result.endPos;
      titleFound = true;
    }
  }

  if (!titleFound) {
    const newlineBeforeTitle = text.slice(pos).match(/^[ \t]*\n[ \t]*/);
    if (newlineBeforeTitle) {
      const result = tryMatchTitle(pos + newlineBeforeTitle[0].length);
      if (result) {
        title = result.title;
        pos = result.endPos;
        titleFound = true;
      }
    }
  }

  if (!titleFound) {
    const endAfterDest = text.slice(pos).match(/^[ \t]*(?:\n|$)/);
    if (endAfterDest) {
      pos += endAfterDest[0].length;
      return {
        label: normalizeLabel(unescapeString(rawLabel)),
        definition: {
          destination: decodeHtmlEntities(unescapeString(destination)),
          title: '',
        },
        consumed: pos,
      };
    }
    return null;
  }

  return {
    label: normalizeLabel(unescapeString(rawLabel)),
    definition: {
      destination: decodeHtmlEntities(unescapeString(destination)),
      title: decodeHtmlEntities(unescapeString(title)),
    },
    consumed: pos,
  };
}

export function isLinkReferenceStart(line: string): boolean {
  return /^ {0,3}\[/.test(line);
}
