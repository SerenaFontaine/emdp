/**
 * Parser for GFM tables built from pipe-delimited rows.
 */

import type {
  TableNode,
  TableRowNode,
  TableCellNode,
  TableAlignment,
  InlineNode,
} from '../types.js';

export function parseDelimiterRow(line: string): TableAlignment[] | null {
  const trimmed = line.trim();

  let cells = splitTableRow(trimmed);

  if (cells.length === 0) return null;

  const alignments: TableAlignment[] = [];

  for (const cell of cells) {
    const content = cell.trim();

    if (!/^:?-+:?$/.test(content)) {
      return null;
    }

    const hasLeftColon = content.startsWith(':');
    const hasRightColon = content.endsWith(':');

    if (hasLeftColon && hasRightColon) {
      alignments.push('center');
    } else if (hasRightColon) {
      alignments.push('right');
    } else if (hasLeftColon) {
      alignments.push('left');
    } else {
      alignments.push(null);
    }
  }

  return alignments;
}

export function splitTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let i = 0;
  let inBackticks = false;
  let backtickCount = 0;

  let trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) {
    trimmed = trimmed.slice(0, -1);
  }

  while (i < trimmed.length) {
    const char = trimmed[i];

    if (char === '`') {
      if (!inBackticks) {
        inBackticks = true;
        backtickCount = 1;
        let j = i + 1;
        while (j < trimmed.length && trimmed[j] === '`') {
          backtickCount++;
          j++;
        }
        current += trimmed.slice(i, j);
        i = j;
        continue;
      } else {
        let closeCount = 1;
        let j = i + 1;
        while (j < trimmed.length && trimmed[j] === '`') {
          closeCount++;
          j++;
        }
        if (closeCount === backtickCount) {
          inBackticks = false;
        }
        current += trimmed.slice(i, j);
        i = j;
        continue;
      }
    }

    if (char === '\\' && i + 1 < trimmed.length && trimmed[i + 1] === '|') {
      current += '|';
      i += 2;
      continue;
    }

    if (char === '|' && !inBackticks) {
      cells.push(current);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  cells.push(current);

  return cells;
}

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '|') {
      if (i === 0 || trimmed[i - 1] !== '\\') {
        return true;
      }
    }
  }
  return false;
}

export function couldBeTableHeader(line: string): boolean {
  return isTableRow(line);
}

export function isTableStart(headerLine: string, delimiterLine: string): TableAlignment[] | null {
  if (!isTableRow(headerLine)) return null;

  const headerCells = splitTableRow(headerLine);
  const hasContent = headerCells.some(cell => cell.trim() !== '');
  if (!hasContent) return null;
  const alignments = parseDelimiterRow(delimiterLine);

  if (!alignments) return null;

  if (headerCells.length !== alignments.length) return null;

  return alignments;
}

export function createTableCellNode(
  align: TableAlignment,
  isHeader: boolean,
  children: InlineNode[] = []
): TableCellNode {
  return {
    type: 'table_cell',
    children,
    align,
    isHeader,
  };
}

export function createTableRowNode(
  isHeader: boolean,
  cells: TableCellNode[] = []
): TableRowNode {
  return {
    type: 'table_row',
    children: cells,
    isHeader,
  };
}

export function createTableNode(alignments: TableAlignment[]): TableNode {
  return {
    type: 'table',
    alignments,
    children: [],
  };
}

export function parseTableRowCells(
  line: string,
  alignments: TableAlignment[],
  isHeader: boolean
): TableCellNode[] {
  const cellContents = splitTableRow(line);
  const cells: TableCellNode[] = [];

  for (let i = 0; i < alignments.length; i++) {
    const content = cellContents[i]?.trim() ?? '';
    const cell = createTableCellNode(alignments[i], isHeader);
    (cell as any).rawContent = content;
    cells.push(cell);
  }

  return cells;
}
