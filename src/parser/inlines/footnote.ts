/**
 * Parser for GFM footnote labels.
 */

import { normalizeLabel } from '../utils.js';

export interface FootnoteLabelMatch {
  label: string;
  normalized: string;
  length: number;
}

export function parseFootnoteLabel(text: string, pos: number): FootnoteLabelMatch | null {
  if (text[pos] !== '[' || text[pos + 1] !== '^') return null;

  let i = pos + 2;
  let label = '';

  while (i < text.length) {
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

    if (char === ']') {
      break;
    }

    label += char;
    i++;
  }

  if (i >= text.length || text[i] !== ']') return null;
  if (label.length === 0 || label.length > 999) return null;

  return {
    label,
    normalized: normalizeLabel(label),
    length: i - pos + 1,
  };
}
