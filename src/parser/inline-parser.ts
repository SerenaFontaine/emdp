/**
 * Inline parsing phase that builds inline nodes such as emphasis, links, images, code spans,
 * autolinks, and HTML.
 */

import type {
  InlineNode,
  TextNode,
  EmphasisNode,
  StrongNode,
  LinkNode,
  ImageNode,
  LinkReferenceDefinition,
} from './types.js';
import { parseEscape } from './inlines/escape.js';
import { parseEntity } from './inlines/entity.js';
import { parseCodeSpan } from './inlines/code-span.js';
import { parseDelimiterRun, canDelimitersMatch, DelimiterRun } from './inlines/emphasis.js';
import { parseAutolink } from './inlines/autolink.js';
import { parseInlineLink, parseLinkLabel, createLinkNode, createImageNode } from './inlines/link.js';
import { createTextNode } from './inlines/text.js';
import { normalizeLabel } from './utils.js';

interface Delimiter {
  run: DelimiterRun;
  node: TextNode;
  active: boolean;
  prev: Delimiter | null;
  next: Delimiter | null;
}

interface Bracket {
  type: 'link' | 'image';
  node: TextNode;
  nodeIndex: number;
  active: boolean;
  prev: Bracket | null;
  bracketAfter: boolean;
  delimiterBefore: Delimiter | null;
  textPos: number;
}

export class InlineParser {
  private linkReferences: Map<string, LinkReferenceDefinition> = new Map();

  setLinkReferences(refs: Map<string, LinkReferenceDefinition>): void {
    this.linkReferences = refs;
  }

  parse(text: string): InlineNode[] {
    const nodes: InlineNode[] = [];
    let delimiterStack: Delimiter | null = null;
    let bracketStack: Bracket | null = null;

    let pos = 0;
    let textBuffer = '';

    const flushText = (): void => {
      if (textBuffer.length > 0) {
        nodes.push(createTextNode(textBuffer));
        textBuffer = '';
      }
    };

    const pushDelimiter = (run: DelimiterRun, node: TextNode): void => {
      const d: Delimiter = {
        run,
        node,
        active: true,
        prev: delimiterStack,
        next: null,
      };
      if (delimiterStack) {
        delimiterStack.next = d;
      }
      delimiterStack = d;
    };

    while (pos < text.length) {
      const char = text[pos];

      const escapeResult = parseEscape(text, pos);
      if (escapeResult) {
        if (escapeResult.char === '\n') {
          textBuffer = textBuffer.replace(/ *$/, '');
          flushText();
          nodes.push({ type: 'hardbreak' });
          pos += escapeResult.length;
          while (pos < text.length && text[pos] === ' ') {
            pos++;
          }
        } else if (escapeResult.char === '*' || escapeResult.char === '_') {
          flushText();
          nodes.push(createTextNode(escapeResult.char, true));
          pos += escapeResult.length;
        } else if (escapeResult.char === '"' || escapeResult.char === "'" ||
          escapeResult.char === '-' || escapeResult.char === '.') {
          flushText();
          const node = createTextNode(escapeResult.char);
          node.noSmart = true;
          nodes.push(node);
          pos += escapeResult.length;
        } else {
          textBuffer += escapeResult.char;
          pos += escapeResult.length;
        }
        continue;
      }

      const entityResult = parseEntity(text, pos);
      if (entityResult) {
        textBuffer += entityResult.char;
        pos += entityResult.length;
        continue;
      }

      if (char === '`') {
        const codeSpanResult = parseCodeSpan(text, pos);
        if (codeSpanResult) {
          flushText();
          nodes.push(codeSpanResult.node);
          pos += codeSpanResult.length;
          continue;
        } else {
          textBuffer += char;
          pos++;
          while (pos < text.length && text[pos] === '`') {
            textBuffer += text[pos];
            pos++;
          }
          continue;
        }
      }

      if (char === '<') {
        const autolinkResult = parseAutolink(text, pos);
        if (autolinkResult) {
          flushText();
          nodes.push(autolinkResult.node);
          pos += autolinkResult.length;
          continue;
        }

        const openingTagMatch = text.slice(pos).match(/^<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z_:][a-zA-Z0-9_.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>/);
        if (openingTagMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: openingTagMatch[0] });
          pos += openingTagMatch[0].length;
          continue;
        }

        const closingTagMatch = text.slice(pos).match(/^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>/);
        if (closingTagMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: closingTagMatch[0] });
          pos += closingTagMatch[0].length;
          continue;
        }

        const shortCommentMatch = text.slice(pos).match(/^<!---?>/);
        if (shortCommentMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: '<!---->' });
          pos += shortCommentMatch[0].length;
          continue;
        }

        const commentMatch = text.slice(pos).match(/^<!--(?!>)(?!-?>)[\s\S]*?-->/);
        if (commentMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: commentMatch[0] });
          pos += commentMatch[0].length;
          continue;
        }

        const piMatch = text.slice(pos).match(/^<\?[\s\S]*?\?>/);
        if (piMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: piMatch[0] });
          pos += piMatch[0].length;
          continue;
        }

        const cdataMatch = text.slice(pos).match(/^<!\[CDATA\[[\s\S]*?\]\]>/);
        if (cdataMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: cdataMatch[0] });
          pos += cdataMatch[0].length;
          continue;
        }

        const declMatch = text.slice(pos).match(/^<![a-zA-Z][\s\S]*?>/);
        if (declMatch) {
          flushText();
          nodes.push({ type: 'html_inline', literal: declMatch[0] });
          pos += declMatch[0].length;
          continue;
        }
      }

      if (char === ' ') {
        let spaceCount = 0;
        let j = pos;
        while (j < text.length && text[j] === ' ') {
          spaceCount++;
          j++;
        }
        if (text[j] === '\n' && spaceCount >= 2) {
          textBuffer = textBuffer.replace(/ *$/, '');
          flushText();
          nodes.push({ type: 'hardbreak' });
          pos = j + 1;
          while (pos < text.length && text[pos] === ' ') {
            pos++;
          }
          continue;
        }
      }

      if (char === '\n') {
        textBuffer = textBuffer.replace(/ *$/, '');
        flushText();
        nodes.push({ type: 'softbreak' });
        pos++;
        while (pos < text.length && text[pos] === ' ') {
          pos++;
        }
        continue;
      }

      if (char === '*' || char === '_') {
        flushText();
        const run = parseDelimiterRun(text, pos);
        if (run) {
          const node = createTextNode(text.slice(pos, pos + run.length));
          (node as any).delimiterOrigLength = run.length;
          nodes.push(node);
          if (run.canOpen || run.canClose) {
            pushDelimiter(run, node);
          }
          pos += run.length;
          continue;
        }
      }

      if (char === '!' && text[pos + 1] === '[') {
        flushText();
        const node = createTextNode('![');
        nodes.push(node);
        const bracket: Bracket = {
          type: 'image',
          node,
          nodeIndex: nodes.length - 1,
          active: true,
          prev: bracketStack,
          bracketAfter: false,
          delimiterBefore: delimiterStack,
          textPos: pos + 2,
        };
        if (bracketStack) bracketStack.bracketAfter = true;
        bracketStack = bracket;
        pos += 2;
        continue;
      }

      if (char === '[') {
        flushText();
        const node = createTextNode('[');
        nodes.push(node);
        const bracket: Bracket = {
          type: 'link',
          node,
          nodeIndex: nodes.length - 1,
          active: true,
          prev: bracketStack,
          bracketAfter: false,
          delimiterBefore: delimiterStack,
          textPos: pos + 1,
        };
        if (bracketStack) bracketStack.bracketAfter = true;
        bracketStack = bracket;
        pos += 1;
        continue;
      }

      if (char === ']' && bracketStack) {
        flushText();

        let opener: Bracket | null = bracketStack;
        if (!opener) {
          textBuffer += ']';
          pos++;
          continue;
        }
        if (!opener.active) {
          bracketStack = opener.prev;
          textBuffer += ']';
          pos++;
          continue;
        }

        let matched = false;
        let destination = '';
        let title = '';
        let consumed = 1;

        if (text[pos + 1] === '(') {
          const linkResult = parseInlineLink(text, pos + 1);
          if (linkResult) {
            matched = true;
            destination = linkResult.destination;
            title = linkResult.title;
            consumed = 1 + linkResult.length;
          }
        }

        if (!matched && text[pos + 1] === '[') {
          const labelResult = parseLinkLabel(text, pos + 1);
          if (labelResult && labelResult.label) {
            if (this.linkReferences.has(labelResult.label)) {
              matched = true;
              const ref = this.linkReferences.get(labelResult.label)!;
              destination = ref.destination;
              title = ref.title;
              consumed = 1 + labelResult.length;
            }
          } else if (labelResult && labelResult.label === '') {
            const innerText = this.extractTextFromNodes(nodes.slice(opener.nodeIndex + 1));
            const label = normalizeLabel(innerText);
            if (this.linkReferences.has(label)) {
              matched = true;
              const ref = this.linkReferences.get(label)!;
              destination = ref.destination;
              title = ref.title;
              consumed = 1 + labelResult.length;
            }
          }
        }

        if (!matched && text[pos + 1] !== '[') {
          const rawLabel = text.slice(opener.textPos, pos);
          const label = normalizeLabel(this.normalizeLabelForMatching(rawLabel));
          if (label && this.linkReferences.has(label)) {
            matched = true;
            const ref = this.linkReferences.get(label)!;
            destination = ref.destination;
            title = ref.title;
          }
        }

        if (matched) {
          const innerNodes = nodes.splice(opener.nodeIndex + 1);
          nodes.pop();

          this.processEmphasis(innerNodes, opener.delimiterBefore);

          if (opener.type === 'image') {
            const alt = this.extractTextFromNodes(innerNodes);
            nodes.push(createImageNode(destination, title, alt));
          } else {
            const linkNode = createLinkNode(destination, title);
            linkNode.children = innerNodes;
            nodes.push(linkNode);
          }

          if (opener.type === 'link') {
            let b = opener.prev;
            while (b) {
              if (b.type === 'link') b.active = false;
              b = b.prev;
            }
          }

          bracketStack = opener.prev;
          pos += consumed;
        } else {
          bracketStack = opener.prev;
          textBuffer += ']';
          pos++;
        }
        continue;
      }

      textBuffer += char;
      pos++;
    }

    flushText();
    this.processEmphasis(nodes, null);
    return nodes;
  }

  private extractTextFromNodes(nodes: InlineNode[]): string {
    let result = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        result += node.literal;
      } else if (node.type === 'code_span') {
        result += node.literal;
      } else if (node.type === 'image') {
        result += node.alt;
      } else if (node.type === 'softbreak' || node.type === 'hardbreak') {
        result += ' ';
      } else if ('children' in node && Array.isArray(node.children)) {
        result += this.extractTextFromNodes(node.children as InlineNode[]);
      }
    }
    return result;
  }

  private normalizeLabelForMatching(rawLabel: string): string {
    let result = '';
    let i = 0;
    while (i < rawLabel.length) {
      if (rawLabel[i] === '\\' && i + 1 < rawLabel.length) {
        const next = rawLabel[i + 1];
        if (next === '[' || next === ']' || next === '\\') {
          result += next;
          i += 2;
          continue;
        }
      }
      result += rawLabel[i];
      i++;
    }
    return result;
  }

  private processEmphasis(nodes: InlineNode[], stackBottom: Delimiter | null): void {
    const delimiters: Delimiter[] = [];
    let prevDelim: Delimiter | null = null;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'text' && (node.literal.match(/^[*_]+$/) || node.literal === '')) {
      }
    }

    const nodeDelims: { node: TextNode; index: number; run: DelimiterRun }[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'text' && node.literal.length > 0 && !node.noDelim) {
        const firstChar = node.literal[0];
        if ((firstChar === '*' || firstChar === '_') && node.literal.match(/^[*_]+$/)) {
          const beforeNode = i > 0 ? nodes[i - 1] : null;
          const afterNode = i < nodes.length - 1 ? nodes[i + 1] : null;

          let charBefore = '\n';
          if (beforeNode) {
            if (beforeNode.type === 'text') {
              charBefore = this.getLastChar(beforeNode.literal);
            } else if (beforeNode.type === 'softbreak' || beforeNode.type === 'hardbreak') {
              charBefore = '\n';
            } else {
              charBefore = 'a';
            }
          }

          let charAfter = '\n';
          if (afterNode) {
            if (afterNode.type === 'text') {
              charAfter = this.getFirstChar(afterNode.literal);
            } else if (afterNode.type === 'softbreak' || afterNode.type === 'hardbreak') {
              charAfter = '\n';
            } else {
              charAfter = 'a';
            }
          }

          const run = this.computeDelimiterRun(node.literal, charBefore, charAfter);
          (node as any).delimiterOrigLength = (node as any).delimiterOrigLength ?? node.literal.length;
          run.origLength = (node as any).delimiterOrigLength;
          if (run.canOpen || run.canClose) {
            nodeDelims.push({ node, index: i, run });
          }
        }
      }
    }

    if (nodeDelims.length === 0) return;

    const openerBottomByChar: Record<string, number> = { '*': -1, '_': -1 };

    let closerIdx = 0;
    while (closerIdx < nodeDelims.length) {
      const closer = nodeDelims[closerIdx];
      if (!closer.run.canClose) {
        closerIdx++;
        continue;
      }

      let openerIdx = closerIdx - 1;
      let openerFound = false;

      while (openerIdx >= 0 && openerIdx > openerBottomByChar[closer.run.char]) {
        const opener = nodeDelims[openerIdx];
        if (opener.run.canOpen && opener.run.char === closer.run.char &&
            canDelimitersMatch(opener.run, closer.run)) {
          openerFound = true;
          break;
        }
        openerIdx--;
      }

      if (!openerFound) {
        if (!closer.run.canOpen) {
          openerBottomByChar[closer.run.char] = closerIdx - 1;
        }
        closerIdx++;
        continue;
      }

      const opener = nodeDelims[openerIdx];
      const strong = opener.run.length >= 2 && closer.run.length >= 2;
      const numDelims = strong ? 2 : 1;

      opener.node.literal = opener.node.literal.slice(0, -numDelims);
      closer.node.literal = closer.node.literal.slice(numDelims);
      opener.run.length -= numDelims;
      closer.run.length -= numDelims;

      const openerNodeIdx = nodes.indexOf(opener.node);
      const closerNodeIdx = nodes.indexOf(closer.node);

      const contentNodes = nodes.slice(openerNodeIdx + 1, closerNodeIdx);

      const emphNode: EmphasisNode | StrongNode = strong
        ? { type: 'strong', children: contentNodes }
        : { type: 'emphasis', children: contentNodes };

      nodes.splice(openerNodeIdx + 1, closerNodeIdx - openerNodeIdx - 1, emphNode);

      const shift = closerNodeIdx - openerNodeIdx - 2;
      for (let i = openerIdx + 1; i < nodeDelims.length; i++) {
        if (i < closerIdx) {
          nodeDelims[i].run.length = 0;
        }
      }

      if (opener.run.length === 0) {
        const idx = nodes.indexOf(opener.node);
        if (idx !== -1 && opener.node.literal === '') {
          nodes.splice(idx, 1);
        }
      }
      if (closer.run.length === 0) {
        const idx = nodes.indexOf(closer.node);
        if (idx !== -1 && closer.node.literal === '') {
          nodes.splice(idx, 1);
        }
      }

      nodeDelims.length = 0;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type === 'text' && node.literal.length > 0 && !node.noDelim) {
          const firstChar = node.literal[0];
          if ((firstChar === '*' || firstChar === '_') && node.literal.match(/^[*_]+$/)) {
            const beforeNode = i > 0 ? nodes[i - 1] : null;
            const afterNode = i < nodes.length - 1 ? nodes[i + 1] : null;
            let charBefore = '\n';
            let charAfter = '\n';
            if (beforeNode) {
              if (beforeNode.type === 'text') charBefore = this.getLastChar(beforeNode.literal);
              else if (beforeNode.type !== 'softbreak' && beforeNode.type !== 'hardbreak') charBefore = 'a';
            }
            if (afterNode) {
              if (afterNode.type === 'text') charAfter = this.getFirstChar(afterNode.literal);
              else if (afterNode.type !== 'softbreak' && afterNode.type !== 'hardbreak') charAfter = 'a';
            }
            const run = this.computeDelimiterRun(node.literal, charBefore, charAfter);
            (node as any).delimiterOrigLength = (node as any).delimiterOrigLength ?? node.literal.length;
            run.origLength = (node as any).delimiterOrigLength;
            if (run.canOpen || run.canClose) {
              nodeDelims.push({ node, index: i, run });
            }
          }
        }
      }
      closerIdx = 0;
    }

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.type === 'text' && node.literal === '') {
        nodes.splice(i, 1);
      }
    }
  }

  private computeDelimiterRun(literal: string, charBefore: string, charAfter: string): DelimiterRun {
    const char = literal[0] as '*' | '_';
    const length = literal.length;

    const isWhitespace = (c: string): boolean => /\s/.test(c) || c === '\n';
    const isPunctuation = (c: string): boolean => /[\p{P}\p{S}]/u.test(c);

    const beforeIsWhitespace = isWhitespace(charBefore);
    const afterIsWhitespace = isWhitespace(charAfter);
    const beforeIsPunctuation = isPunctuation(charBefore);
    const afterIsPunctuation = isPunctuation(charAfter);

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

    return { char, length, canOpen, canClose, position: 0, origLength: length };
  }

  private getFirstChar(text: string): string {
    if (!text) return '\n';
    return Array.from(text)[0] ?? '\n';
  }

  private getLastChar(text: string): string {
    if (!text) return '\n';
    const chars = Array.from(text);
    return chars.length > 0 ? chars[chars.length - 1] : '\n';
  }
}
