/**
 * Entry point for GitHub Flavored Markdown that re-exports GFM helpers, renderer, and AST types.
 */

export * from './parser/gfm/index.js';
export { default } from './parser/gfm/index.js';

export type {
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
  TableNode,
  TableRowNode,
  TableCellNode,
  TableAlignment,
  TextNode,
  SoftbreakNode,
  HardbreakNode,
  CodeSpanNode,
  EmphasisNode,
  StrongNode,
  StrikethroughNode,
  LinkNode,
  ImageNode,
  HtmlInlineNode,
  ParseOptions,
  RenderOptions,
} from './parser/types.js';
