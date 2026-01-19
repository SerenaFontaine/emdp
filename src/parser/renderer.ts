/**
 * HTML renderer that converts a Markdown AST into HTML with configurable list, URL safety,
 * and soft-break handling.
 */

import type {
  DocumentNode,
  BlockNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  ThematicBreakNode,
  CodeBlockNode,
  BlockquoteNode,
  ListNode,
  ListItemNode,
  HtmlBlockNode,
  TextNode,
  SoftbreakNode,
  HardbreakNode,
  CodeSpanNode,
  EmphasisNode,
  StrongNode,
  LinkNode,
  ImageNode,
  HtmlInlineNode,
  RenderOptions,
} from './types.js';
import { escapeHtml } from './utils.js';

function encodeUrl(url: string): string {
  let result = '';
  let i = 0;
  while (i < url.length) {
    const char = url[i];
    const code = char.charCodeAt(0);

    if (char === '%' && i + 2 < url.length && /^[0-9a-fA-F]{2}$/.test(url.slice(i + 1, i + 3))) {
      result += url.slice(i, i + 3).toUpperCase();
      i += 3;
    } else if (/[A-Za-z0-9\-._~:/?#@!$&'()*+,;=]/.test(char)) {
      result += char;
      i++;
    } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < url.length) {
      const fullChar = url.slice(i, i + 2);
      const encoded = encodeURIComponent(fullChar);
      result += encoded;
      i += 2;
    } else {
      const encoded = encodeURIComponent(char);
      result += encoded;
      i++;
    }
  }
  return result;
}

export class HtmlRenderer {
  private options: RenderOptions;

  constructor(options: RenderOptions = {}) {
    this.options = {
      softbreak: '\n',
      safe: false,
      ...options,
    };
  }

  render(document: DocumentNode): string {
    const content = this.renderBlocks(document.children);
    return content ? content + '\n' : '';
  }

  private renderBlocks(blocks: BlockNode[], tight = false): string {
    return blocks.map(block => this.renderBlock(block, tight)).join('\n');
  }

  private renderBlock(block: BlockNode, tight = false): string {
    switch (block.type) {
      case 'paragraph':
        return this.renderParagraph(block, tight);
      case 'heading':
        return this.renderHeading(block);
      case 'thematic_break':
        return this.renderThematicBreak(block);
      case 'code_block':
        return this.renderCodeBlock(block);
      case 'blockquote':
        return this.renderBlockquote(block);
      case 'list':
        return this.renderList(block);
      case 'list_item':
        return this.renderListItem(block);
      case 'html_block':
        return this.renderHtmlBlock(block);
      default:
        return '';
    }
  }

  private renderParagraph(node: ParagraphNode, tight = false): string {
    const content = this.renderInlines(node.children);
    if (tight) {
      return content;
    }
    return `<p>${content}</p>`;
  }

  private renderHeading(node: HeadingNode): string {
    const content = this.renderInlines(node.children);
    return `<h${node.level}>${content}</h${node.level}>`;
  }

  private renderThematicBreak(_node: ThematicBreakNode): string {
    return '<hr />';
  }

  private renderCodeBlock(node: CodeBlockNode): string {
    const escaped = escapeHtml(node.literal);
    if (node.info) {
      const lang = escapeHtml(node.info.split(/\s+/)[0]);
      return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
    }
    return `<pre><code>${escaped}</code></pre>`;
  }

  private renderBlockquote(node: BlockquoteNode): string {
    const content = this.renderBlocks(node.children);
    if (content) {
      return `<blockquote>\n${content}\n</blockquote>`;
    }
    return '<blockquote>\n</blockquote>';
  }

  private renderList(node: ListNode): string {
    const tag = node.listType === 'bullet' ? 'ul' : 'ol';
    const startAttr = node.listType === 'ordered' && node.start !== 1 ? ` start="${node.start}"` : '';
    const items = node.children.map(item => this.renderListItem(item, node.tight)).join('\n');
    return `<${tag}${startAttr}>\n${items}\n</${tag}>`;
  }

  private renderListItem(node: ListItemNode, tight = false): string {
    if (node.children.length === 0) {
      return '<li></li>';
    }

    const content = this.renderBlocks(node.children, tight);

    if (tight && node.children.length === 1 && node.children[0].type === 'paragraph') {
      return `<li>${content}</li>`;
    }

    if (content) {
      return `<li>\n${content}\n</li>`;
    }
    return '<li></li>';
  }

  private renderHtmlBlock(node: HtmlBlockNode): string {
    if (this.options.safe) {
      return '<!-- raw HTML omitted -->';
    }
    return node.literal.replace(/\n$/, '');
  }

  private renderInlines(inlines: InlineNode[]): string {
    if (this.options.smart) {
      return this.renderInlinesSmart(inlines);
    }
    return inlines.map(inline => this.renderInline(inline)).join('');
  }

  private renderInline(inline: InlineNode): string {
    switch (inline.type) {
      case 'text':
        return this.renderText(inline);
      case 'softbreak':
        return this.renderSoftbreak(inline);
      case 'hardbreak':
        return this.renderHardbreak(inline);
      case 'code_span':
        return this.renderCodeSpan(inline);
      case 'emphasis':
        return this.renderEmphasis(inline);
      case 'strong':
        return this.renderStrong(inline);
      case 'link':
        return this.renderLink(inline);
      case 'image':
        return this.renderImage(inline);
      case 'html_inline':
        return this.renderHtmlInline(inline);
      default:
        return '';
    }
  }

  private renderText(node: TextNode): string {
    return escapeHtml(node.literal);
  }

  private renderSoftbreak(_node: SoftbreakNode): string {
    return this.options.softbreak!;
  }

  private renderHardbreak(_node: HardbreakNode): string {
    return '<br />\n';
  }

  private renderCodeSpan(node: CodeSpanNode): string {
    return `<code>${escapeHtml(node.literal)}</code>`;
  }

  private renderEmphasis(node: EmphasisNode): string {
    const content = this.renderInlines(node.children);
    return `<em>${content}</em>`;
  }

  private renderStrong(node: StrongNode): string {
    const content = this.renderInlines(node.children);
    return `<strong>${content}</strong>`;
  }

  private renderLink(node: LinkNode): string {
    if (this.options.safe && /^javascript:/i.test(node.destination)) {
      return this.renderInlines(node.children);
    }

    const href = escapeHtml(encodeUrl(node.destination));
    const title = node.title ? ` title="${escapeHtml(node.title)}"` : '';
    const content = this.renderInlines(node.children);
    return `<a href="${href}"${title}>${content}</a>`;
  }

  private renderImage(node: ImageNode): string {
    if (this.options.safe && /^javascript:/i.test(node.destination)) {
      return escapeHtml(node.alt);
    }

    const src = escapeHtml(encodeUrl(node.destination));
    const alt = escapeHtml(node.alt);
    const title = node.title ? ` title="${escapeHtml(node.title)}"` : '';
    return `<img src="${src}" alt="${alt}"${title} />`;
  }

  private renderHtmlInline(node: HtmlInlineNode): string {
    if (this.options.safe) {
      return '<!-- raw HTML omitted -->';
    }
    return node.literal;
  }

  private renderInlinesSmart(inlines: InlineNode[]): string {
    type Token = {
      char: string;
      node: TextNode | null;
      nodeOffset: number;
      noSmart: boolean;
    };

    const tokens: Token[] = [];
    const nodeTokens = new Map<TextNode, number[]>();

    const pushTextTokens = (node: TextNode): void => {
      const indices: number[] = [];
      for (let i = 0; i < node.literal.length; i++) {
        const idx = tokens.length;
        tokens.push({
          char: node.literal[i],
          node,
          nodeOffset: i,
          noSmart: !!node.noSmart,
        });
        indices.push(idx);
      }
      nodeTokens.set(node, indices);
    };

    for (const inline of inlines) {
      if (inline.type === 'text') {
        pushTextTokens(inline as TextNode);
      } else if (inline.type === 'softbreak' || inline.type === 'hardbreak') {
        tokens.push({ char: '\n', node: null, nodeOffset: 0, noSmart: false });
      } else {
        tokens.push({ char: 'A', node: null, nodeOffset: 0, noSmart: false });
      }
    }

    const replacements = new Map<number, string>();
    const doubleStack: number[] = [];
    const singleStack: number[] = [];

    const isWhitespace = (c: string): boolean => /\s/.test(c);
    const isPunctuation = (c: string): boolean => /[\p{P}\p{S}]/u.test(c);
    const isAlphaNum = (c: string): boolean => /[A-Za-z0-9]/.test(c);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.noSmart) continue;
      if (token.char !== '"' && token.char !== "'") continue;

      const before = i > 0 ? tokens[i - 1].char : '\n';
      const after = i + 1 < tokens.length ? tokens[i + 1].char : '\n';

      const beforeIsWhitespace = isWhitespace(before);
      const afterIsWhitespace = isWhitespace(after);
      const beforeIsPunct = isPunctuation(before);
      const afterIsPunct = isPunctuation(after);

      let leftFlanking = !afterIsWhitespace &&
        (!afterIsPunct || beforeIsWhitespace || beforeIsPunct);
      let rightFlanking = !beforeIsWhitespace &&
        (!beforeIsPunct || afterIsWhitespace || afterIsPunct);

      if (before === ')' || before === ']') {
        leftFlanking = false;
      }

      if (token.char === "'") {
        if (isAlphaNum(before) && isAlphaNum(after)) {
          replacements.set(i, '’');
          continue;
        }
        if ((before === ')' || before === ']') && isAlphaNum(after)) {
          replacements.set(i, '’');
          continue;
        }

        if (rightFlanking && singleStack.length > 0) {
          const opener = singleStack.pop()!;
          replacements.set(opener, '‘');
          replacements.set(i, '’');
          continue;
        }
        if (leftFlanking) {
          singleStack.push(i);
          continue;
        }
        replacements.set(i, '’');
      } else {
        if (rightFlanking && doubleStack.length > 0) {
          const opener = doubleStack.pop()!;
          replacements.set(opener, '“');
          replacements.set(i, '”');
          continue;
        }
        if (leftFlanking) {
          doubleStack.push(i);
          continue;
        }
        replacements.set(i, '“');
      }
    }

    for (const idx of doubleStack) {
      replacements.set(idx, '“');
    }
    for (const idx of singleStack) {
      replacements.set(idx, '’');
    }

    const renderTextNodes = new Map<TextNode, string>();
    for (const [node, indices] of nodeTokens.entries()) {
      if (node.noSmart) {
        renderTextNodes.set(node, escapeHtml(node.literal));
        continue;
      }
      let result = '';
      for (let i = 0; i < indices.length; i++) {
        const tokenIndex = indices[i];
        const token = tokens[tokenIndex];
        const replacement = replacements.get(tokenIndex);
        result += replacement ?? token.char;
      }
      result = this.applyDashesAndEllipses(result);
      renderTextNodes.set(node, escapeHtml(result));
    }

    return inlines.map(inline => {
      if (inline.type === 'text') {
        return renderTextNodes.get(inline as TextNode) ?? '';
      }
      return this.renderInline(inline);
    }).join('');
  }

  private applyDashesAndEllipses(text: string): string {
    let result = text.replace(/\.{3}/g, '…');
    result = result.replace(/-{2,}/g, (match) => {
      const count = match.length;
      if (count % 3 === 0) {
        return '—'.repeat(count / 3);
      }
      if (count % 2 === 0) {
        return '–'.repeat(count / 2);
      }
      let emCount = Math.floor(count / 3);
      const remainder = count % 3;
      let enCount = 0;
      if (remainder === 1) {
        emCount = Math.max(0, emCount - 1);
        enCount = 2;
      } else if (remainder === 2) {
        enCount = 1;
      }
      return '—'.repeat(emCount) + '–'.repeat(enCount);
    });
    return result;
  }
}
