/**
 * Core parser module that coordinates block and inline parsing and exposes the main parser
 * class and convenience helpers.
 */

import type {
  DocumentNode,
  BlockNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  ParseOptions,
  RenderOptions,
  LinkReferenceDefinition,
} from './types.js';
import { BlockParser } from './block-parser.js';
import { InlineParser } from './inline-parser.js';
import { HtmlRenderer } from './renderer.js';

export * from './types.js';
export { BlockParser } from './block-parser.js';
export { InlineParser } from './inline-parser.js';
export { HtmlRenderer } from './renderer.js';

export class MarkdownParser {
  private blockParser: BlockParser;
  private inlineParser: InlineParser;
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = options;
    this.blockParser = new BlockParser();
    this.inlineParser = new InlineParser();
  }

  parse(input: string): DocumentNode {
    const { document, linkReferences } = this.blockParser.parse(input);

    this.inlineParser.setLinkReferences(linkReferences);

    this.processInlines(document, linkReferences);

    return document;
  }

  private processInlines(
    document: DocumentNode,
    linkReferences: Map<string, LinkReferenceDefinition>
  ): void {
    const processBlock = (block: BlockNode): void => {
      if (block.type === 'paragraph') {
        const para = block as ParagraphNode;
        const rawContent = (para as any).rawContent;
        if (rawContent) {
          para.children = this.inlineParser.parse(rawContent);
          delete (para as any).rawContent;
        }
      } else if (block.type === 'heading') {
        const heading = block as HeadingNode;
        const rawContent = (heading as any).rawContent;
        if (rawContent) {
          heading.children = this.inlineParser.parse(rawContent);
          delete (heading as any).rawContent;
        }
      } else if (block.type === 'blockquote') {
        block.children.forEach(processBlock);
      } else if (block.type === 'list') {
        block.children.forEach(item => {
          item.children.forEach(processBlock);
        });
      } else if (block.type === 'list_item') {
        block.children.forEach(processBlock);
      }
    };

    document.children.forEach(processBlock);
  }
}

export function parse(input: string, options?: ParseOptions): DocumentNode {
  const parser = new MarkdownParser(options);
  return parser.parse(input);
}

export function render(document: DocumentNode, options?: RenderOptions): string {
  const renderer = new HtmlRenderer(options);
  return renderer.render(document);
}

export function markdown(input: string, options?: ParseOptions & RenderOptions): string {
  const document = parse(input, options);
  return render(document, options);
}

export default {
  parse,
  render,
  markdown,
  MarkdownParser,
  BlockParser,
  InlineParser,
  HtmlRenderer,
};
