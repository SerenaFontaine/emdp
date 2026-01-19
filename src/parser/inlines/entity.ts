/**
 * Parser for HTML character entities in inline content.
 */

import { decodeHtmlEntities } from '../utils.js';

const ENTITY_REGEX = /^&(?:#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{0,31});/;

export function parseEntity(text: string, pos: number): { char: string; length: number } | null {
  if (text[pos] !== '&') return null;

  const remaining = text.slice(pos);
  const match = remaining.match(ENTITY_REGEX);

  if (!match) return null;

  const entity = match[0];
  const decoded = decodeHtmlEntities(entity);

  if (decoded === entity) return null;

  return { char: decoded, length: entity.length };
}

export function isEntityStart(text: string, pos: number): boolean {
  return text[pos] === '&';
}
