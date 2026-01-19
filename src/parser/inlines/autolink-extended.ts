/**
 * Parser for GFM extended autolinks that recognize bare URLs and emails.
 */

import type { LinkNode } from '../types.js';

const VALID_PRECEDING_CHARS = new Set([
  '\n', ' ', '\t', '*', '_', '~', '(', '"', "'",
]);

const VALID_EMAIL_PRECEDING_CHARS = new Set([
  '\n', ' ', '\t', '*', '_', '~', '(', '"', "'", ':', '/',
]);

function isValidPrecedingChar(char: string | undefined): boolean {
  if (char === undefined) return true;
  return VALID_PRECEDING_CHARS.has(char);
}

function isValidEmailPrecedingChar(char: string | undefined): boolean {
  if (char === undefined) return true;
  return VALID_EMAIL_PRECEDING_CHARS.has(char);
}

function precededByOpenAngle(text: string, pos: number): boolean {
  let i = pos - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n')) {
    i--;
  }
  return i >= 0 && text[i] === '<';
}

function isDomainChar(char: string): boolean {
  if (/[a-zA-Z0-9_-]/.test(char)) return true;
  const code = char.codePointAt(0);
  return code !== undefined && code > 127;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xD800 && code <= 0xDBFF;
}

function parseValidDomain(text: string, startPos: number, requirePeriod: boolean = true): { domain: string; endPos: number } | null {
  let pos = startPos;
  const segments: string[] = [];
  let currentSegment = '';

  while (pos < text.length) {
    const char = text[pos];
    const code = char.charCodeAt(0);

    if (isHighSurrogate(code) && pos + 1 < text.length) {
      const fullChar = text.slice(pos, pos + 2);
      currentSegment += fullChar;
      pos += 2;
    } else if (isDomainChar(char)) {
      currentSegment += char;
      pos++;
    } else if (char === '.') {
      if (currentSegment.length === 0) break;
      segments.push(currentSegment);
      currentSegment = '';
      pos++;
    } else {
      break;
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  if (requirePeriod && segments.length < 2) return null;
  if (!requirePeriod && segments.length < 1) return null;

  if (segments.length >= 2) {
    const lastTwo = segments.slice(-2);
    for (const seg of lastTwo) {
      if (seg.includes('_')) return null;
    }
  }

  return {
    domain: segments.join('.'),
    endPos: pos,
  };
}

function trimAutolinkPath(url: string): string {
  let result = url;

  const ltIndex = result.indexOf('<');
  if (ltIndex !== -1) {
    result = result.slice(0, ltIndex);
  }

  while (result.length > 0) {
    const lastChar = result[result.length - 1];

    if ('?!.,:*_~"\''.includes(lastChar)) {
      result = result.slice(0, -1);
      continue;
    }

    if (lastChar === ')') {
      const openCount = (result.match(/\(/g) || []).length;
      const closeCount = (result.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        result = result.slice(0, -1);
        continue;
      }
    }

    if (lastChar === ';') {
      const entityMatch = result.match(/&[a-zA-Z0-9]+;$/);
      if (entityMatch) {
        result = result.slice(0, -entityMatch[0].length);
        continue;
      }
    }

    break;
  }

  return result;
}

export function parseWwwAutolink(
  text: string,
  pos: number,
  charBefore: string | undefined
): { node: LinkNode; length: number } | null {
  if (!isValidPrecedingChar(charBefore)) return null;
  if (precededByOpenAngle(text, pos)) return null;

  if (!text.slice(pos).toLowerCase().startsWith('www.')) return null;

  const domainStart = pos + 4;
  const domainResult = parseValidDomain(text, domainStart, true);
  if (!domainResult) return null;

  let endPos = domainResult.endPos;
  while (endPos < text.length) {
    const char = text[endPos];
    if (char === ' ' || char === '\t' || char === '\n' || char === '<') break;
    endPos++;
  }

  const fullMatch = text.slice(pos, endPos);
  const trimmedUrl = trimAutolinkPath(fullMatch);

  if (trimmedUrl.length <= 4) return null;

  return {
    node: {
      type: 'link',
      destination: 'http://' + trimmedUrl,
      title: '',
      children: [{ type: 'text', literal: trimmedUrl }],
    },
    length: trimmedUrl.length,
  };
}

export function parseUrlAutolink(
  text: string,
  pos: number,
  charBefore: string | undefined
): { node: LinkNode; length: number } | null {
  if (!isValidPrecedingChar(charBefore)) return null;
  if (precededByOpenAngle(text, pos)) return null;

  const remaining = text.slice(pos);

  let scheme: string | null = null;
  if (remaining.toLowerCase().startsWith('https://')) {
    scheme = 'https://';
  } else if (remaining.toLowerCase().startsWith('http://')) {
    scheme = 'http://';
  } else if (remaining.toLowerCase().startsWith('ftp://')) {
    scheme = 'ftp://';
  }

  if (!scheme) return null;

  const domainStart = pos + scheme.length;
  const domainResult = parseValidDomain(text, domainStart, false);
  if (!domainResult) return null;

  let endPos = domainResult.endPos;
  while (endPos < text.length) {
    const char = text[endPos];
    if (char === ' ' || char === '\t' || char === '\n' || char === '<') break;
    endPos++;
  }

  const fullMatch = text.slice(pos, endPos);
  const trimmedUrl = trimAutolinkPath(fullMatch);

  if (trimmedUrl.length <= scheme.length) return null;

  return {
    node: {
      type: 'link',
      destination: trimmedUrl,
      title: '',
      children: [{ type: 'text', literal: trimmedUrl }],
    },
    length: trimmedUrl.length,
  };
}

export function parseEmailAutolink(
  text: string,
  pos: number,
  charBefore: string | undefined
): { node: LinkNode; length: number } | null {
  if (!isValidEmailPrecedingChar(charBefore)) return null;
  if (precededByOpenAngle(text, pos)) return null;

  let localEnd = pos;
  while (localEnd < text.length) {
    const char = text[localEnd];
    if (/[a-zA-Z0-9.\-_+]/.test(char)) {
      localEnd++;
    } else {
      break;
    }
  }

  if (localEnd === pos) return null;
  if (text[localEnd] !== '@') return null;

  const localPart = text.slice(pos, localEnd);
  const domainStart = localEnd + 1;

  let domainEnd = domainStart;
  let lastDotPos = -1;
  let segmentStart = domainStart;

  while (domainEnd < text.length) {
    const char = text[domainEnd];
    if (/[a-zA-Z0-9\-_]/.test(char)) {
      domainEnd++;
    } else if (char === '.') {
      if (domainEnd === segmentStart) break;
      lastDotPos = domainEnd;
      segmentStart = domainEnd + 1;
      domainEnd++;
    } else {
      break;
    }
  }

  if (lastDotPos === -1) return null;

  const lastDomainChar = text[domainEnd - 1];
  if (lastDomainChar === '-' || lastDomainChar === '_') return null;

  let finalEnd = domainEnd;
  while (finalEnd > domainStart && text[finalEnd - 1] === '.') {
    finalEnd--;
  }

  const domain = text.slice(domainStart, finalEnd);
  if (!domain.includes('.')) return null;

  const email = localPart + '@' + domain;

  return {
    node: {
      type: 'link',
      destination: 'mailto:' + email,
      title: '',
      children: [{ type: 'text', literal: email }],
    },
    length: email.length,
  };
}

export function parseProtocolAutolink(
  text: string,
  pos: number,
  charBefore: string | undefined
): { node: LinkNode; length: number } | null {
  if (!isValidEmailPrecedingChar(charBefore)) return null;
  if (precededByOpenAngle(text, pos)) return null;

  const remaining = text.slice(pos);

  let protocol: string | null = null;
  if (remaining.toLowerCase().startsWith('mailto:')) {
    protocol = 'mailto:';
  } else if (remaining.toLowerCase().startsWith('xmpp:')) {
    protocol = 'xmpp:';
  }

  if (!protocol) return null;

  const emailStart = pos + protocol.length;

  let localEnd = emailStart;
  while (localEnd < text.length) {
    const char = text[localEnd];
    if (/[a-zA-Z0-9.\-_+]/.test(char)) {
      localEnd++;
    } else {
      break;
    }
  }

  if (localEnd === emailStart) return null;
  if (text[localEnd] !== '@') return null;

  const localPart = text.slice(emailStart, localEnd);
  const domainStart = localEnd + 1;

  let domainEnd = domainStart;
  let lastDotPos = -1;
  let segmentStart = domainStart;

  while (domainEnd < text.length) {
    const char = text[domainEnd];
    if (/[a-zA-Z0-9\-_]/.test(char)) {
      domainEnd++;
    } else if (char === '.') {
      if (domainEnd === segmentStart) break;
      lastDotPos = domainEnd;
      segmentStart = domainEnd + 1;
      domainEnd++;
    } else {
      break;
    }
  }

  if (lastDotPos === -1) return null;

  const lastDomainChar = text[domainEnd - 1];
  if (lastDomainChar === '-' || lastDomainChar === '_') return null;

  let finalEnd = domainEnd;
  while (finalEnd > domainStart && text[finalEnd - 1] === '.') {
    finalEnd--;
  }

  const domain = text.slice(domainStart, finalEnd);
  if (!domain.includes('.')) return null;

  let fullUrl = protocol + localPart + '@' + domain;
  let consumedLength = fullUrl.length;

  if (protocol === 'xmpp:' && finalEnd < text.length && text[finalEnd] === '/') {
    let resourceEnd = finalEnd + 1;
    while (resourceEnd < text.length) {
      const char = text[resourceEnd];
      if (/[a-zA-Z0-9@.]/.test(char)) {
        resourceEnd++;
      } else {
        break;
      }
    }
    if (resourceEnd > finalEnd + 1) {
      let resource = text.slice(finalEnd, resourceEnd);
      const secondSlash = resource.indexOf('/', 1);
      if (secondSlash !== -1) {
        resource = resource.slice(0, secondSlash);
      }
      while (resource.length > 1 && '?!.,:*_~'.includes(resource[resource.length - 1])) {
        resource = resource.slice(0, -1);
      }
      if (resource.length > 1) {
        fullUrl += resource;
        consumedLength = fullUrl.length;
      }
    }
  }

  return {
    node: {
      type: 'link',
      destination: fullUrl,
      title: '',
      children: [{ type: 'text', literal: fullUrl }],
    },
    length: consumedLength,
  };
}

export function parseExtendedAutolink(
  text: string,
  pos: number,
  charBefore: string | undefined
): { node: LinkNode; length: number } | null {
  return (
    parseProtocolAutolink(text, pos, charBefore) ||
    parseUrlAutolink(text, pos, charBefore) ||
    parseWwwAutolink(text, pos, charBefore) ||
    parseEmailAutolink(text, pos, charBefore)
  );
}
