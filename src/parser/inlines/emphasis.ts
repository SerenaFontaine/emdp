/**
 * Parser for emphasis and strong emphasis using * and _ delimiters.
 */

import { isUnicodeWhitespace, isUnicodePunctuation } from '../utils.js';

export interface DelimiterRun {
  char: '*' | '_';
  length: number;
  canOpen: boolean;
  canClose: boolean;
  position: number;
  origLength: number;
}

export function parseDelimiterRun(text: string, pos: number): DelimiterRun | null {
  const char = text[pos];
  if (char !== '*' && char !== '_') return null;

  let length = 0;
  let i = pos;
  while (i < text.length && text[i] === char) {
    length++;
    i++;
  }

  const charBefore = pos > 0 ? text[pos - 1] : '\n';
  const charAfter = i < text.length ? text[i] : '\n';

  const beforeIsWhitespace = isUnicodeWhitespace(charBefore) || charBefore === '\n';
  const afterIsWhitespace = isUnicodeWhitespace(charAfter) || charAfter === '\n';
  const beforeIsPunctuation = isUnicodePunctuation(charBefore);
  const afterIsPunctuation = isUnicodePunctuation(charAfter);

  const leftFlanking = !afterIsWhitespace &&
    (!afterIsPunctuation || beforeIsWhitespace || beforeIsPunctuation);

  const rightFlanking = !beforeIsWhitespace &&
    (!beforeIsPunctuation || afterIsWhitespace || afterIsPunctuation);

  let canOpen: boolean;
  let canClose: boolean;

  if (char === '*') {
    canOpen = leftFlanking;
    canClose = rightFlanking;
  } else {
    canOpen = leftFlanking && (!rightFlanking || beforeIsPunctuation);
    canClose = rightFlanking && (!leftFlanking || afterIsPunctuation);
  }

  return {
    char: char as '*' | '_',
    length,
    canOpen,
    canClose,
    position: pos,
    origLength: length,
  };
}

export function isEmphasisDelimiter(text: string, pos: number): boolean {
  const char = text[pos];
  return char === '*' || char === '_';
}

export function canDelimitersMatch(opener: DelimiterRun, closer: DelimiterRun): boolean {
  if (opener.char !== closer.char) return false;

  if ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose)) {
    if ((opener.origLength + closer.origLength) % 3 === 0) {
      if (opener.origLength % 3 !== 0 || closer.origLength % 3 !== 0) {
        return false;
      }
    }
  }

  return true;
}
