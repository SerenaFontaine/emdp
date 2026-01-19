/**
 * GFM parser entry point that exposes the CommonMark superset with GFM extensions.
 */

import type {
  DocumentNode,
  BlockNode,
  InlineNode,
  ParagraphNode,
  HeadingNode,
  TableNode,
  TableCellNode,
  ParseOptions,
  RenderOptions,
  LinkReferenceDefinition,
  FootnoteDefinition,
} from '../types.js';
import { GFMBlockParser } from './block-parser.js';
import { GFMInlineParser } from './inline-parser.js';
import { GFMHtmlRenderer } from './renderer.js';

export { GFMBlockParser } from './block-parser.js';
export { GFMInlineParser } from './inline-parser.js';
export { GFMHtmlRenderer } from './renderer.js';

const DEFAULT_GFM_EXTENSIONS = new Set([
  'table',
  'strikethrough',
  'tasklist',
  'autolink',
  'tagfilter',
  'footnotes',
]);

function normalizeExtensions(extensions?: string[]): Set<string> {
  if (extensions === undefined) {
    return new Set(DEFAULT_GFM_EXTENSIONS);
  }
  return new Set(extensions.map(ext => ext.trim()).filter(Boolean));
}

export class GFMParser {
  private blockParser: GFMBlockParser;
  private inlineParser: GFMInlineParser;
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = options;
    const extensions = normalizeExtensions(options.extensions);
    this.blockParser = new GFMBlockParser(extensions);
    this.inlineParser = new GFMInlineParser(extensions);
  }

  parse(input: string): DocumentNode {
    const { document, linkReferences, footnoteDefinitions } = this.blockParser.parse(input);

    this.inlineParser.setLinkReferences(linkReferences);
    this.inlineParser.setFootnoteDefinitions(footnoteDefinitions);

    this.processInlines(document, linkReferences, footnoteDefinitions);

    document.footnoteDefinitions = footnoteDefinitions;

    return document;
  }

  private processInlines(
    document: DocumentNode,
    linkReferences: Map<string, LinkReferenceDefinition>,
    footnoteDefinitions: Map<string, FootnoteDefinition>
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
      } else if (block.type === 'table') {
        const table = block as TableNode;
        for (const row of table.children) {
          for (const cell of row.children) {
            const rawContent = (cell as any).rawContent;
            if (rawContent !== undefined) {
              cell.children = this.inlineParser.parse(rawContent);
              delete (cell as any).rawContent;
            }
          }
        }
      }
    };

    document.children.forEach(processBlock);
    footnoteDefinitions.forEach(def => {
      def.blocks.forEach(processBlock);
    });
  }
}

export function parse(input: string, options?: ParseOptions): DocumentNode {
  const parser = new GFMParser(options);
  return parser.parse(input);
}

export function render(document: DocumentNode, options?: RenderOptions): string {
  const renderer = new GFMHtmlRenderer(options);
  return renderer.render(document);
}

export function gfm(input: string, options?: ParseOptions & RenderOptions): string {
  const extensions = normalizeExtensions(options?.extensions);
  const document = parse(input, { ...options, extensions: Array.from(extensions) });
  const renderOptions = {
    ...options,
    tagfilter: options?.tagfilter ?? extensions.has('tagfilter'),
  };
  return render(document, renderOptions);
}

export default {
  parse,
  render,
  gfm,
  GFMParser,
  GFMBlockParser,
  GFMInlineParser,
  GFMHtmlRenderer,
};
