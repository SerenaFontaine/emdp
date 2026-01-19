# CommonMark Parser (with GFM support)

A CommonMark-compliant Markdown parser with an optional GitHub Flavored Markdown (GFM) mode, plus a small set of cmark-gfm compatible extensions.

## Features

- **CommonMark parser** with block and inline support
- **GFM mode** (tables, strikethrough, task lists, extended autolinks, tag filtering)
- **Footnotes** (GFM-style)
- **HTML rendering** with safe-mode controls
- **CLI** for pipeline usage
- **TypeScript types** and ESM exports

## Installation

```bash
npm install emdp
```

## Quick Start

### CommonMark

```js
import { markdown } from 'emdp';

const html = markdown('# Hello *world*');
console.log(html);
```

### GFM

```js
import { gfm } from 'emdp/gfm';

const html = gfm('- [x] done\n- [ ] todo');
console.log(html);
```

## Usage Examples

### Render with Options

```js
import { gfm } from 'emdp/gfm';

const html = gfm(source, {
  safe: true,
  smart: true,
  tablePreferStyleAttributes: true,
  fullInfoString: true,
  tagfilter: true,
  extensions: ['table', 'strikethrough', 'autolink', 'tagfilter', 'tasklist', 'footnotes'],
});
```

### Parse and Render Separately

```js
import { parse, render } from 'emdp';
import { parse as gfmParse, render as gfmRender } from 'emdp/gfm';

const doc = parse(source);
const html = render(doc);

const gfmDoc = gfmParse(source);
const gfmHtml = gfmRender(gfmDoc, { smart: true });
```

## CLI

```bash
# CommonMark
mdparse < README.md

# GFM
mdparse --gfm < README.md
```

### CLI Flags

- `--gfm` - enable GFM parsing
- `-e <extension>` - enable specific extensions (for test compatibility)
- `--smart` - smart punctuation
- `--table-prefer-style-attributes` - use style attributes for table alignment
- `--full-info-string` - render full info string as data-meta on code blocks
- `--unsafe` - ignored (compatibility flag)

## API Reference

### CommonMark

- `markdown(input, options)` - parse + render
- `parse(input, options)` - parse into AST
- `render(document, options)` - render AST to HTML

### GFM

- `gfm(input, options)` - parse + render (GFM)
- `parse(input, options)` - parse into AST (GFM)
- `render(document, options)` - render AST to HTML (GFM)

### Render Options

- `safe` - omit raw HTML output
- `softbreak` - string used for soft line breaks (default: `\n`)
- `smart` - enable smart punctuation
- `tablePreferStyleAttributes` - use style attributes for table alignment
- `fullInfoString` - include full info string as `data-meta` on code blocks
- `tagfilter` - escape disallowed raw HTML tags (GFM tag filter)
- `extensions` - list of GFM extensions to enable (defaults to all supported)

## License

[MIT License](LICENSE)
