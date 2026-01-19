#!/usr/bin/env node
/**
 * Command-line interface for the Markdown parser that reads Markdown from stdin and writes rendered
 * HTML to stdout with optional GFM flags.
 */

import { markdown } from './parser/index.js';
import { gfm } from './parser/gfm/index.js';

const args = process.argv.slice(2);

const extensions: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-e' && i + 1 < args.length) {
    extensions.push(args[i + 1]);
    i++;
  }
}

const useGfm = args.includes('--gfm') || extensions.length > 0;
const renderOptions = {
  tablePreferStyleAttributes: args.includes('--table-prefer-style-attributes') ||
    extensions.includes('table-prefer-style-attributes'),
  fullInfoString: args.includes('--full-info-string') || extensions.includes('full-info-string'),
  smart: args.includes('--smart') || extensions.includes('smart'),
  softbreak: '\n',
};

let input = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  const html = useGfm
    ? gfm(input, { ...renderOptions, extensions })
    : markdown(input, renderOptions);
  process.stdout.write(html);
});
