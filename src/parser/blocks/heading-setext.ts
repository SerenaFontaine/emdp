/**
 * Parser for setext headings underlined with = or -.
 */

const SETEXT_HEADING_REGEX = /^( {0,3})(=+|-+)[ \t]*$/;

export function parseSetextHeading(line: string): { level: 1 | 2 } | null {
  const match = line.match(SETEXT_HEADING_REGEX);
  if (!match) return null;

  const char = match[2][0];
  const level = char === '=' ? 1 : 2;

  return { level: level as 1 | 2 };
}

export function isSetextHeadingUnderline(line: string): boolean {
  return SETEXT_HEADING_REGEX.test(line);
}

export function getSetextLevel(line: string): 1 | 2 | null {
  const result = parseSetextHeading(line);
  return result?.level ?? null;
}
