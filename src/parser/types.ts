/**
 * Type definitions for the Markdown AST nodes and parser/render options.
 */

export type BlockType =
  | 'document'
  | 'paragraph'
  | 'heading'
  | 'thematic_break'
  | 'code_block'
  | 'blockquote'
  | 'list'
  | 'list_item'
  | 'html_block'
  | 'link_reference_definition'
  | 'table';

export type InlineType =
  | 'text'
  | 'softbreak'
  | 'hardbreak'
  | 'code_span'
  | 'emphasis'
  | 'strong'
  | 'strikethrough'
  | 'footnote_ref'
  | 'link'
  | 'image'
  | 'html_inline';

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export interface BaseNode {
  type: string;
  sourcepos?: SourceLocation;
}

export interface DocumentNode extends BaseNode {
  type: 'document';
  children: BlockNode[];
  footnoteDefinitions?: Map<string, FootnoteDefinition>;
}

export interface ParagraphNode extends BaseNode {
  type: 'paragraph';
  children: InlineNode[];
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface ThematicBreakNode extends BaseNode {
  type: 'thematic_break';
}

export interface CodeBlockNode extends BaseNode {
  type: 'code_block';
  info: string;
  literal: string;
  fenced: boolean;
}

export interface BlockquoteNode extends BaseNode {
  type: 'blockquote';
  children: BlockNode[];
}

export interface ListNode extends BaseNode {
  type: 'list';
  listType: 'bullet' | 'ordered';
  start: number;
  tight: boolean;
  delimiter: '.' | ')' | null;
  bulletChar: '-' | '+' | '*' | null;
  children: ListItemNode[];
}

export interface ListItemNode extends BaseNode {
  type: 'list_item';
  children: BlockNode[];
  checked?: boolean | null;
}

export interface HtmlBlockNode extends BaseNode {
  type: 'html_block';
  literal: string;
}

export type TableAlignment = 'left' | 'center' | 'right' | null;

export interface TableCellNode extends BaseNode {
  type: 'table_cell';
  children: InlineNode[];
  align: TableAlignment;
  isHeader: boolean;
}

export interface TableRowNode extends BaseNode {
  type: 'table_row';
  children: TableCellNode[];
  isHeader: boolean;
}

export interface TableNode extends BaseNode {
  type: 'table';
  alignments: TableAlignment[];
  children: TableRowNode[];
}

export interface LinkReferenceDefinition {
  destination: string;
  title: string;
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | ThematicBreakNode
  | CodeBlockNode
  | BlockquoteNode
  | ListNode
  | ListItemNode
  | HtmlBlockNode
  | TableNode;

export interface TextNode extends BaseNode {
  type: 'text';
  literal: string;
  noDelim?: boolean;
  noSmart?: boolean;
}

export interface SoftbreakNode extends BaseNode {
  type: 'softbreak';
}

export interface HardbreakNode extends BaseNode {
  type: 'hardbreak';
}

export interface CodeSpanNode extends BaseNode {
  type: 'code_span';
  literal: string;
}

export interface EmphasisNode extends BaseNode {
  type: 'emphasis';
  children: InlineNode[];
}

export interface StrongNode extends BaseNode {
  type: 'strong';
  children: InlineNode[];
}

export interface StrikethroughNode extends BaseNode {
  type: 'strikethrough';
  children: InlineNode[];
}

export interface FootnoteRefNode extends BaseNode {
  type: 'footnote_ref';
  label: string;
  key: string;
}

export interface LinkNode extends BaseNode {
  type: 'link';
  destination: string;
  title: string;
  children: InlineNode[];
}

export interface ImageNode extends BaseNode {
  type: 'image';
  destination: string;
  title: string;
  alt: string;
}

export interface HtmlInlineNode extends BaseNode {
  type: 'html_inline';
  literal: string;
}

export type InlineNode =
  | TextNode
  | SoftbreakNode
  | HardbreakNode
  | CodeSpanNode
  | EmphasisNode
  | StrongNode
  | StrikethroughNode
  | FootnoteRefNode
  | LinkNode
  | ImageNode
  | HtmlInlineNode;

export interface FootnoteDefinition {
  label: string;
  blocks: BlockNode[];
}

export interface ParseOptions {
  sourcepos?: boolean;
  extensions?: string[];
}

export interface RenderOptions {
  softbreak?: string;
  safe?: boolean;
  tablePreferStyleAttributes?: boolean;
  fullInfoString?: boolean;
  smart?: boolean;
  tagfilter?: boolean;
  extensions?: string[];
}
