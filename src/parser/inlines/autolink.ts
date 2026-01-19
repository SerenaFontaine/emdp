/**
 * Parser for autolinks enclosed in angle brackets.
 */

import type { LinkNode } from '../types.js';

const AUTOLINK_URI_REGEX = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s<>]*)>/;
const AUTOLINK_EMAIL_REGEX = /^<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;

export function parseAutolink(text: string, pos: number): { node: LinkNode; length: number } | null {
  if (text[pos] !== '<') return null;

  const remaining = text.slice(pos);

  const uriMatch = remaining.match(AUTOLINK_URI_REGEX);
  if (uriMatch) {
    const uri = uriMatch[1];
    return {
      node: {
        type: 'link',
        destination: uri,
        title: '',
        children: [{ type: 'text', literal: uri }],
      },
      length: uriMatch[0].length,
    };
  }

  const emailMatch = remaining.match(AUTOLINK_EMAIL_REGEX);
  if (emailMatch) {
    const email = emailMatch[1];
    return {
      node: {
        type: 'link',
        destination: `mailto:${email}`,
        title: '',
        children: [{ type: 'text', literal: email }],
      },
      length: emailMatch[0].length,
    };
  }

  return null;
}

export function isAutolinkStart(text: string, pos: number): boolean {
  return text[pos] === '<';
}
