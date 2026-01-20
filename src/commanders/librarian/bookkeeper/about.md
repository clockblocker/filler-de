# Bookkeeper Module

Splits long markdown files into paginated folder structures.

## Philosophy

User experience is the north star.

Unit of split = paragraphs and sentences, not words or symbols.

Pages can be longer/shorter to keep context intact.

Target ~3k chars per page (soft limit). Hard limit ~6k chars.

Use heuristics and segmentation tools to preserve semantic units.

## Input/Output

```
Library/Märchen/Aschenputtel-Märchen.md
↓
Library/Märchen/Aschenputtel/
  __-Aschenputtel-Märchen.md                   # codex (index)
  Aschenputtel_Page_000-Aschenputtel-Märchen.md
  Aschenputtel_Page_001-Aschenputtel-Märchen.md
  ...
```

## Module Structure

```
bookkeeper/
  index.ts                 # exports
  types.ts                 # zod enums + types
  page-codec.ts            # Page naming: CoreName_Page_NNN-Suffix
  build-actions.ts         # VaultAction[] generation
  split-to-pages-action.ts # command handler
  error/
    index.ts               # SplitToPagesErrorKind enum + handlers
  segmenter/
    index.ts               # main algorithm + page break logic
    parse-blocks.ts        # content → TextBlock[] with quote tracking
    sentence-splitter.ts   # Intl.Segmenter for sentence boundaries
    rules/index.ts         # dialogue, speech-intro, paragraph rules
```

## Zod Enums

```ts
TextBlockKind: Paragraph | Heading | Dialogue | Blank
DialoguePosition: Start | Middle | End | Single
SplitToPagesErrorKind: NoPwd | NoContent | ParseFailed | DispatchFailed
```

## TextBlock Flags

```ts
type TextBlock = {
  kind: TextBlockKind;
  lines: string[];
  charCount: number;
  dialoguePosition?: DialoguePosition;  // for dialogue exchanges
  isSentenceSplit?: boolean;            // created by sentence splitter
  introducesSpeech?: boolean;           // ends with ':' before dialogue
  isQuotedContent?: boolean;            // multi-line quoted content (poems)
};
```

## Segmentation Rules

### 1. Quote-Aware Block Parsing

Tracks open/close quote state across lines using:
- German opening: `„`, `»`
- German closing: `"`, `«`
- ASCII neutral: `"` (context-dependent)

When inside unclosed quote:
- Blank lines don't create block breaks
- Multi-line poems/songs stay as single block
- Block marked with `isQuotedContent: true`

### 2. Speech Introduction Rule

Blocks ending with `:` followed by dialogue:
- Marked with `introducesSpeech: true`
- Page break prevented between intro and speech
- Works for both Paragraph and Dialogue blocks

### 3. Dialogue Preservation

German dialogue patterns kept together:
- Quotation marks: `"`, `»`, `„`
- Attribution verbs: `sagte`, `fragte`, `rief`, `flüsterte`...
- Consecutive dialogue blocks form exchanges

### 4. Sentence Boundary Validation

Before creating page break, checks:
- Does block end with sentence-ending punctuation? (`.`, `!`, `?`, closing quote)
- If ends with `,`, `:`, `;`, `-` → don't split (mid-sentence)
- Allow overflow up to 1.5x max to avoid mid-sentence splits

### 5. Sentence Splitting

Uses `Intl.Segmenter('de', {granularity: 'sentence'})`:
- Applied when paragraph block would exceed target size
- Only paragraphs split; dialogue/heading/blank unchanged
- Note: sub-blocks lose original flags

## Size Targets

| Setting | Value | Purpose |
|---------|-------|---------|
| Target | 3000 chars | Soft target for page size |
| Max | 6000 chars | Hard limit (can overflow for quotes) |
| Min | 1500 chars | Below this, don't split at all |

Quoted content (`isQuotedContent: true`) can exceed max to preserve integrity.

## Page Break Logic

`shouldCreatePageBreak()` checks in order:

1. No next block → don't break
2. Under target → only break at headings
3. Last non-blank introduces speech + next is dialogue → don't break
4. Mid-sentence ending → don't break (unless 1.5x max)
5. Rules allow split → break
6. Over max + not quoted → force break

## Behavior

- **Normal files**: Creates folder + codex + page files, trashes original
- **Short files**: Adds `noteKind: Page` frontmatter only, no folder
- **Empty pages**: Filtered out, page indices re-numbered
- **Name conflicts**: Uses `duplicate-name-resolver.ts`

## Page Metadata

All page files get YAML frontmatter:
```yaml
---
noteKind: Page
status: false
---
```

## Command

Registered as `split-to-pages` in main.ts. Invokable via command palette.

## Integration

- Uses `VaultActionManager.dispatch()` for atomic file operations
- Uses `note-metadata-manager` for frontmatter serialization
- Codex follows existing `__-Suffix` naming convention
- Pages are regular ScrollNodes in LibraryTree
