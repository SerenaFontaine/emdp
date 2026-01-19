/**
 * GFM block parser that extends CommonMark with table support.
 */

import type {
  DocumentNode,
  BlockNode,
  BlockquoteNode,
  ListItemNode,
  LinkReferenceDefinition,
  TableNode,
  TableAlignment,
  FootnoteDefinition,
} from '../types.js';
import { normalizeLineEndings, removeIndent, unescapeString, decodeHtmlEntities } from '../utils.js';
import { isThematicBreak, parseThematicBreak } from '../blocks/thematic-break.js';
import { parseAtxHeading, createHeadingNode } from '../blocks/heading-atx.js';
import { getSetextLevel } from '../blocks/heading-setext.js';
import { createIndentedCodeBlock } from '../blocks/code-block-indented.js';
import { parseFenceOpen, isFenceClose, createFencedCodeBlock, FenceInfo } from '../blocks/code-block-fenced.js';
import { createBlockquoteNode } from '../blocks/blockquote.js';
import { parseListMarker, createListNode, createListItemNode, listsMatch, ListMarker } from '../blocks/list.js';
import { getHtmlBlockType, isHtmlBlockClose } from '../blocks/html-block.js';
import { createHtmlBlockNode } from '../blocks/html-block.js';
import { createParagraphNode } from '../blocks/paragraph.js';
import { parseLinkReferenceDefinition } from '../blocks/link-reference.js';
import {
  isTableRow,
  isTableStart,
  createTableNode,
  createTableRowNode,
  parseTableRowCells,
  splitTableRow,
} from '../blocks/table.js';
import { processTaskLists } from '../blocks/task-list.js';
import { parseFootnoteLabel } from '../inlines/footnote.js';

function getIndent(raw: string): number {
  let indent = 0;
  for (const char of raw) {
    if (char === ' ') indent++;
    else if (char === '\t') indent += 4 - (indent % 4);
    else break;
  }
  return indent;
}

export class GFMBlockParser {
  private lines: string[] = [];
  private lineIndex = 0;
  private linkReferences: Map<string, LinkReferenceDefinition> = new Map();
  private footnoteDefinitions: Map<string, FootnoteDefinition> = new Map();
  private static readonly LAZY_PREFIX = '\u0000';
  private enableTables: boolean;
  private enableTaskLists: boolean;
  private enableFootnotes: boolean;

  constructor(extensions?: Set<string>) {
    this.enableTables = !extensions || extensions.has('table');
    this.enableTaskLists = !extensions || extensions.has('tasklist');
    this.enableFootnotes = !extensions || extensions.has('footnotes');
  }

  parse(input: string): {
    document: DocumentNode;
    linkReferences: Map<string, LinkReferenceDefinition>;
    footnoteDefinitions: Map<string, FootnoteDefinition>;
  } {
    this.lines = normalizeLineEndings(input).split('\n');
    this.lineIndex = 0;
    this.linkReferences = new Map();
    this.footnoteDefinitions = new Map();

    const document: DocumentNode = {
      type: 'document',
      children: [],
    };

    this.parseBlocks(document, 0);

    if (this.enableTaskLists) {
      processTaskLists(document.children);
    }

    return {
      document,
      linkReferences: this.linkReferences,
      footnoteDefinitions: this.footnoteDefinitions,
    };
  }

  private currentLine(): string | undefined {
    return this.lines[this.lineIndex];
  }

  private advance(): void {
    this.lineIndex++;
  }

  private parseBlocks(container: DocumentNode | BlockquoteNode | ListItemNode, baseIndent: number): void {
    let paragraphLines: string[] = [];

    const finishParagraph = (): boolean => {
      if (paragraphLines.length > 0) {
        let text = paragraphLines.join('\n');
        let consumed = 0;

        while (text.length > 0) {
          const result = parseLinkReferenceDefinition(text);
          if (!result) break;
          if (!this.linkReferences.has(result.label)) {
            this.linkReferences.set(result.label, result.definition);
          }
          text = text.slice(result.consumed);
          consumed += result.consumed;
        }

        text = text.trim();
        if (text.length > 0) {
          const para = createParagraphNode();
          (para as any).rawContent = text;
          container.children.push(para);
        }
        paragraphLines = [];
        return consumed > 0 || text.length > 0;
      }
      return false;
    };

    while (this.lineIndex < this.lines.length) {
      const line = this.currentLine()!;

      if (line.startsWith(GFMBlockParser.LAZY_PREFIX)) {
        const raw = line.slice(GFMBlockParser.LAZY_PREFIX.length);
        const rawIndent = getIndent(raw);
        paragraphLines.push(removeIndent(raw, Math.min(rawIndent, 3)));
        this.advance();
        continue;
      }
      const lineIndent = getIndent(line);

      if (line.trim() === '') {
        finishParagraph();
        this.advance();
        continue;
      }

      const dedented = removeIndent(line, Math.min(3, lineIndent));

      const trimmed = line.replace(/^ {0,3}/, '');
      if (this.enableFootnotes) {
        const footnoteLabel = parseFootnoteLabel(trimmed, 0);
        if (footnoteLabel && trimmed[footnoteLabel.length] === ':') {
          finishParagraph();
          this.parseFootnoteDefinition(footnoteLabel.label, footnoteLabel.normalized, trimmed, footnoteLabel.length);
          continue;
        }
      }

      if (this.enableTables && paragraphLines.length >= 1) {
        const lastLine = paragraphLines[paragraphLines.length - 1];
        if (isTableRow(lastLine)) {
          const alignments = isTableStart(lastLine, line);
          if (alignments) {
            if (paragraphLines.length > 1) {
              const precedingLines = paragraphLines.slice(0, -1);
              let text = precedingLines.join('\n');
              while (text.length > 0) {
                const result = parseLinkReferenceDefinition(text);
                if (!result) break;
                if (!this.linkReferences.has(result.label)) {
                  this.linkReferences.set(result.label, result.definition);
                }
                text = text.slice(result.consumed);
              }
              text = text.trim();
              if (text.length > 0) {
                const para = createParagraphNode();
                (para as any).rawContent = text;
                container.children.push(para);
              }
            }
            const table = this.parseTable(lastLine, alignments);
            paragraphLines = [];
            container.children.push(table);
            continue;
          }
        }
      }

      if (paragraphLines.length > 0) {
        const setextLevel = getSetextLevel(line);
        if (setextLevel) {
          let content = paragraphLines.join('\n');
          while (content.length > 0) {
            const result = parseLinkReferenceDefinition(content);
            if (!result) break;
            if (!this.linkReferences.has(result.label)) {
              this.linkReferences.set(result.label, result.definition);
            }
            content = content.slice(result.consumed);
          }
          content = content.trim();

          paragraphLines = [];
          if (content.length > 0) {
            const heading = createHeadingNode(setextLevel);
            (heading as any).rawContent = content;
            container.children.push(heading);
          } else if (isThematicBreak(line)) {
            container.children.push(parseThematicBreak(line)!);
          } else {
            paragraphLines.push(line);
          }
          this.advance();
          continue;
        }
      }

      if (isThematicBreak(line)) {
        finishParagraph();
        container.children.push(parseThematicBreak(line)!);
        this.advance();
        continue;
      }

      const atxResult = parseAtxHeading(line);
      if (atxResult) {
        finishParagraph();
        const heading = createHeadingNode(atxResult.level);
        (heading as any).rawContent = atxResult.content;
        container.children.push(heading);
        this.advance();
        continue;
      }

      if (paragraphLines.length > 0 && /^ {0,3}=+[ \t]*$/.test(line)) {
        let content = paragraphLines.join('\n');
        while (content.length > 0) {
          const result = parseLinkReferenceDefinition(content);
          if (!result) break;
          if (!this.linkReferences.has(result.label)) {
            this.linkReferences.set(result.label, result.definition);
          }
          content = content.slice(result.consumed);
        }
        content = content.trim();

        paragraphLines = [];
        if (content.length > 0) {
          const heading = createHeadingNode(1);
          (heading as any).rawContent = content;
          container.children.push(heading);
        } else {
          paragraphLines.push(line);
        }
        this.advance();
        continue;
      }

      const fenceInfo = parseFenceOpen(line);
      if (fenceInfo) {
        finishParagraph();
        const codeLines: string[] = [];
        this.advance();

        let closedProperly = false;
        while (this.lineIndex < this.lines.length) {
          const codeLine = this.currentLine()!;
          if (isFenceClose(codeLine, fenceInfo)) {
            this.advance();
            closedProperly = true;
            break;
          }
          codeLines.push(codeLine);
          this.advance();
        }

        if (!closedProperly) {
          while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') {
            codeLines.pop();
          }
        }

        const info = unescapeString(decodeHtmlEntities(fenceInfo.info));
        container.children.push(createFencedCodeBlock(info, codeLines, fenceInfo.indent));
        continue;
      }

      if (paragraphLines.length === 0 && lineIndent >= 4) {
        const codeLines: string[] = [removeIndent(line, 4)];
        this.advance();

        while (this.lineIndex < this.lines.length) {
          const codeLine = this.currentLine()!;
          const codeIndent = getIndent(codeLine);
          if (codeIndent >= 4) {
            codeLines.push(removeIndent(codeLine, 4));
            this.advance();
          } else if (codeLine.trim() === '') {
            codeLines.push('');
            this.advance();
          } else {
            break;
          }
        }

        while (codeLines.length > 0 && codeLines[codeLines.length - 1] === '') {
          codeLines.pop();
        }

        container.children.push(createIndentedCodeBlock(codeLines));
        continue;
      }

      const bqMatch = line.match(/^ {0,3}>([ \t]?)/);
      if (bqMatch) {
        finishParagraph();
        const blockquote = createBlockquoteNode();
        const quoteLines: string[] = [];
        let inFence: FenceInfo | null = null;

        while (this.lineIndex < this.lines.length) {
          const quoteLine = this.currentLine()!;
          const qMatch = quoteLine.match(/^ {0,3}>([ \t]?)/);

          if (qMatch) {
            const content = this.extractBlockquoteContent(quoteLine, qMatch);
            quoteLines.push(content);
            if (inFence) {
              if (isFenceClose(content, inFence)) {
                inFence = null;
              }
            } else {
              const fenceInfo = parseFenceOpen(content);
              if (fenceInfo) {
                inFence = fenceInfo;
              }
            }
            this.advance();
          } else if (quoteLine.trim() === '') {
            break;
          } else if (quoteLines.length > 0) {
            if (inFence) {
              break;
            }
            if (isThematicBreak(quoteLine) || parseFenceOpen(quoteLine)) {
              break;
            }
            if (quoteLines[quoteLines.length - 1].trim() === '') {
              break;
            }
            const lastContent = this.lastNonBlankLine(quoteLines);
            if (lastContent &&
                !parseFenceOpen(lastContent) &&
                getIndent(lastContent) < 4 &&
                this.allowsLazyAfterListMarker(lastContent)) {
              const nestedPrefix = this.getBlockquotePrefix(lastContent);
              quoteLines.push(nestedPrefix + GFMBlockParser.LAZY_PREFIX + quoteLine);
              this.advance();
            } else {
              break;
            }
          } else {
            break;
          }
        }

        const subParser = new GFMBlockParser();
        const result = subParser.parse(quoteLines.join('\n'));
        blockquote.children = result.document.children;
        result.linkReferences.forEach((def, label) => {
          if (!this.linkReferences.has(label)) {
            this.linkReferences.set(label, def);
          }
        });
        result.footnoteDefinitions.forEach((def, label) => {
          if (!this.footnoteDefinitions.has(label)) {
            this.footnoteDefinitions.set(label, def);
          }
        });
        container.children.push(blockquote);
        continue;
      }

      const listMarker = parseListMarker(line);
      if (listMarker) {
        const canInterrupt = paragraphLines.length === 0 ||
          (listMarker.type === 'bullet' || listMarker.start === 1) &&
          line.slice(listMarker.indent + listMarker.marker.length + listMarker.padding).trim() !== '';

        if (canInterrupt) {
          finishParagraph();
          const list = createListNode(listMarker);
          this.parseList(list, listMarker);
          container.children.push(list);
          continue;
        }
      }

      const htmlType = getHtmlBlockType(line, paragraphLines.length === 0);
      if (htmlType !== null) {
        finishParagraph();
        const htmlLines: string[] = [line];
        const closeOnSameLine = htmlType >= 1 && htmlType <= 5 && isHtmlBlockClose(line, htmlType);
        this.advance();

        if (!closeOnSameLine) {
          while (this.lineIndex < this.lines.length) {
            const htmlLine = this.currentLine()!;

            if (htmlType === 6 || htmlType === 7) {
              if (htmlLine.trim() === '') {
                break;
              }
              htmlLines.push(htmlLine);
              this.advance();
            } else {
              htmlLines.push(htmlLine);
              this.advance();
              if (isHtmlBlockClose(htmlLine, htmlType)) {
                break;
              }
            }
          }
        }

        container.children.push(createHtmlBlockNode(htmlLines.join('\n') + '\n'));
        continue;
      }

      paragraphLines.push(removeIndent(line, Math.min(lineIndent, 3)));
      this.advance();
    }

    finishParagraph();
  }

  private parseTable(headerLine: string, alignments: TableAlignment[]): TableNode {
    const table = createTableNode(alignments);

    const headerCells = parseTableRowCells(headerLine, alignments, true);
    const headerRow = createTableRowNode(true, headerCells);
    table.children.push(headerRow);

    this.advance();

    while (this.lineIndex < this.lines.length) {
      const line = this.currentLine()!;

      if (line.trim() === '') {
        break;
      }

      if (line.match(/^ {0,3}>/)) {
        break;
      }
      if (isThematicBreak(line)) {
        break;
      }
      if (parseAtxHeading(line)) {
        break;
      }
      if (parseFenceOpen(line)) {
        break;
      }
      if (getHtmlBlockType(line, true) !== null) {
        break;
      }

      const cells = parseTableRowCells(line, alignments, false);
      const row = createTableRowNode(false, cells);
      table.children.push(row);

      this.advance();
    }

    return table;
  }

  private parseFootnoteDefinition(label: string, key: string, trimmedLine: string, labelLength: number): void {
    if (!key) {
      this.advance();
      return;
    }

    const contentLines: string[] = [];
    const afterColon = trimmedLine.slice(labelLength + 1);
    const firstContent = afterColon.replace(/^[ \t]+/, '');
    if (firstContent.length > 0) {
      contentLines.push(firstContent);
    }

    this.advance();

    while (this.lineIndex < this.lines.length) {
      const line = this.currentLine()!;
      if (line.trim() === '') {
        let lookahead = this.lineIndex + 1;
        while (lookahead < this.lines.length && this.lines[lookahead].trim() === '') {
          lookahead++;
        }
        if (lookahead < this.lines.length && getIndent(this.lines[lookahead]) >= 4) {
          contentLines.push('');
          this.advance();
          continue;
        }
        break;
      }

      if (getIndent(line) >= 4) {
        contentLines.push(removeIndent(line, 4));
        this.advance();
        continue;
      }

      break;
    }

    const subParser = new GFMBlockParser();
    const result = subParser.parse(contentLines.join('\n'));
    result.linkReferences.forEach((def, refLabel) => {
      if (!this.linkReferences.has(refLabel)) {
        this.linkReferences.set(refLabel, def);
      }
    });

    if (!this.footnoteDefinitions.has(key)) {
      this.footnoteDefinitions.set(key, { label, blocks: result.document.children });
    }
  }

  private parseList(list: any, firstMarker: ListMarker): void {
    let sawBlankLine = false;
    let sawBlankLineInItem = false;
    let sawBlankBetweenItems = false;

    while (this.lineIndex < this.lines.length) {
      const line = this.currentLine()!;
      if (isThematicBreak(line)) {
        break;
      }
      const marker = parseListMarker(line);

      if (marker && listsMatch(firstMarker, marker)) {
        if (sawBlankLine) {
          sawBlankBetweenItems = true;
        }
        sawBlankLine = false;

        const item = createListItemNode();
        const itemResult = this.parseListItem(item, marker);
        if (itemResult.blankInItem) {
          sawBlankLineInItem = true;
        }
        if (itemResult.endsWithBlank) {
          sawBlankLine = true;
        }
        list.children.push(item);
      } else if (line.trim() === '') {
        sawBlankLine = true;
        this.advance();

        let nextIdx = this.lineIndex;
        while (nextIdx < this.lines.length && this.lines[nextIdx].trim() === '') {
          nextIdx++;
        }
        if (nextIdx < this.lines.length) {
          const nextLine = this.lines[nextIdx];
          const nextMarker = parseListMarker(nextLine);
          if (!nextMarker || !listsMatch(firstMarker, nextMarker)) {
            if (getIndent(nextLine) < firstMarker.contentIndent) {
              break;
            }
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }

    if (sawBlankLineInItem || sawBlankBetweenItems) {
      list.tight = false;
    }
  }

  private parseListItem(item: any, marker: ListMarker): { blankInItem: boolean; endsWithBlank: boolean } {
    const itemLines: string[] = [];
    let firstLine = this.currentLine()!;
    if (firstLine.startsWith(GFMBlockParser.LAZY_PREFIX)) {
      firstLine = firstLine.slice(GFMBlockParser.LAZY_PREFIX.length);
    }

    let firstContent = this.extractListItemContent(firstLine, marker);

    if (firstContent.trim() === '' && firstLine.slice(marker.indentChars + marker.marker.length).match(/^[ \t]/)) {
      itemLines.push('');
    } else {
      itemLines.push(firstContent);
    }
    this.advance();

    let sawBlankLine = false;
    let blankLineInItem = false;
    let trailingBlanks = 0;
    const contentIndent = marker.contentIndent;
    const baseThreshold = contentIndent + 1;
    let lastNonBlankIndent: number | null = firstContent.trim() === '' ? null : contentIndent;
    let lastNonBlankWasListMarker = false;
    let sawNonBlankContent = firstContent.trim() !== '';
    let inFence: FenceInfo | null = null;

    if (firstContent.trim() !== '') {
      const firstFence = parseFenceOpen(firstContent);
      if (firstFence) {
        inFence = firstFence;
      }
      lastNonBlankWasListMarker = parseListMarker(firstContent) !== null;
    }

    while (this.lineIndex < this.lines.length) {
      let line = this.currentLine()!;
      let lazyLine = false;
      if (line.startsWith(GFMBlockParser.LAZY_PREFIX)) {
        line = line.slice(GFMBlockParser.LAZY_PREFIX.length);
        lazyLine = true;
      }
      const lineIndent = getIndent(line);

      if (inFence) {
        const contentLine = lineIndent >= contentIndent ? removeIndent(line, contentIndent) : line;
        itemLines.push(contentLine);
        if (isFenceClose(contentLine, inFence)) {
          inFence = null;
        }
        this.advance();
        continue;
      }

      if (line.trim() === '') {
        sawBlankLine = true;
        trailingBlanks++;
        itemLines.push('');
        this.advance();
        continue;
      }

      const newMarker = lazyLine ? null : parseListMarker(line);
      if (newMarker && listsMatch(marker, newMarker) && newMarker.indent < contentIndent) {
        break;
      }

      if (!sawNonBlankContent && sawBlankLine && lineIndent >= contentIndent) {
        break;
      }

      if (lineIndent >= contentIndent) {
        const contentLine = removeIndent(line, contentIndent);
        const isListMarker = parseListMarker(contentLine) !== null;
        if (sawBlankLine && (lineIndent <= baseThreshold ||
            (lastNonBlankIndent !== null && lastNonBlankIndent <= baseThreshold && !lastNonBlankWasListMarker))) {
          blankLineInItem = true;
        }
        sawBlankLine = false;
        trailingBlanks = 0;
        itemLines.push(contentLine);
        lastNonBlankIndent = lineIndent;
        lastNonBlankWasListMarker = isListMarker;
        sawNonBlankContent = true;
        if (!inFence) {
          const fenceInfo = parseFenceOpen(contentLine);
          if (fenceInfo) {
            inFence = fenceInfo;
          }
        }
        this.advance();
      } else if (sawBlankLine) {
        break;
      } else {
        if (!isThematicBreak(line) && !parseAtxHeading(line) &&
            !parseFenceOpen(line) && !line.match(/^ {0,3}>/) &&
            !newMarker) {
          trailingBlanks = 0;
          itemLines.push(line);
          lastNonBlankIndent = lineIndent;
          lastNonBlankWasListMarker = false;
          sawNonBlankContent = true;
          this.advance();
        } else {
          break;
        }
      }
    }

    const endsWithBlank = trailingBlanks > 0;

    while (itemLines.length > 0 && itemLines[itemLines.length - 1] === '') {
      itemLines.pop();
    }

    const subParser = new GFMBlockParser();
    const result = subParser.parse(itemLines.join('\n'));
    item.children = result.document.children;
    result.linkReferences.forEach((def: LinkReferenceDefinition, label: string) => {
      if (!this.linkReferences.has(label)) {
        this.linkReferences.set(label, def);
      }
    });
    result.footnoteDefinitions.forEach((def, label) => {
      if (!this.footnoteDefinitions.has(label)) {
        this.footnoteDefinitions.set(label, def);
      }
    });

    const paragraphCount = item.children.filter((child: any) => child.type === 'paragraph').length;
    if (paragraphCount >= 2) {
      blankLineInItem = true;
    }

    return { blankInItem: blankLineInItem, endsWithBlank };
  }

  private lastNonBlankLine(lines: string[]): string | null {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.trim() !== '') {
        return line;
      }
    }
    return null;
  }

  private getBlockquotePrefix(line: string): string {
    let i = 0;
    let prefix = '';
    while (i < line.length) {
      let spaces = 0;
      const start = i;
      while (i < line.length && line[i] === ' ' && spaces < 3) {
        spaces++;
        i++;
      }
      if (i < line.length && line[i] === '>') {
        i++;
        if (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
          i++;
        }
        prefix += line.slice(start, i);
      } else {
        break;
      }
    }
    return prefix;
  }

  private allowsLazyAfterListMarker(line: string): boolean {
    const marker = parseListMarker(line);
    if (!marker) {
      return true;
    }
    const afterMarker = line.slice(marker.contentCharIndex);
    return /^[ \t]*>/.test(afterMarker);
  }

  private extractBlockquoteContent(line: string, match: RegExpMatchArray): string {
    const optionalSpace = match[1];

    let column = 0;
    let charIndex = 0;

    while (charIndex < line.length && line[charIndex] === ' ' && charIndex < 3) {
      column++;
      charIndex++;
    }

    charIndex++;
    column++;

    let result = '';

    if (optionalSpace === '\t') {
      const tabWidth = 4 - (column % 4);
      const remaining = tabWidth - 1;
      if (remaining > 0) {
        result = ' '.repeat(remaining);
      }
      charIndex++;
      column += tabWidth;
    } else if (optionalSpace === ' ') {
      charIndex++;
      column++;
    }

    while (charIndex < line.length) {
      const char = line[charIndex];
      if (char === '\t') {
        const tabWidth = 4 - (column % 4);
        result += ' '.repeat(tabWidth);
        column += tabWidth;
      } else {
        result += char;
        column++;
      }
      charIndex++;
    }

    return result;
  }

  private extractListItemContent(line: string, marker: ListMarker): string {
    let column = 0;
    let charIndex = 0;
    let result = '';

    while (charIndex < line.length && charIndex < marker.indentChars) {
      if (line[charIndex] === '\t') {
        column = column + (4 - (column % 4));
      } else {
        column++;
      }
      charIndex++;
    }

    charIndex += marker.marker.length;
    column += marker.marker.length;

    if (charIndex < line.length && marker.paddingChars > 0) {
      const paddingChar = line[charIndex];
      if (paddingChar === '\t') {
        const tabWidth = 4 - (column % 4);
        const consumed = Math.min(tabWidth, marker.padding);
        column += consumed;
        charIndex += marker.paddingChars;
        const remaining = tabWidth - consumed;
        if (remaining > 0) {
          result += ' '.repeat(remaining);
          column += remaining;
        }
      } else {
        column += marker.padding;
        charIndex += marker.paddingChars;
      }
    }

    while (charIndex < line.length) {
      const char = line[charIndex];
      if (char === '\t') {
        const tabWidth = 4 - (column % 4);
        result += ' '.repeat(tabWidth);
        column += tabWidth;
      } else {
        result += char;
        column++;
      }
      charIndex++;
    }

    return result;
  }
}
