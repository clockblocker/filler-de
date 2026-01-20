# Bookkeeper Module

Splits long markdown files into paginated folder structures.

## Phylosophy

our north star shoul be user experience.

the unit of the split in not words, or sybbols, but paragraphs and sentences

we can make pages a bit longer of shorter to keep the context intact.

we do whant to pages to be about 3k symbols, but this is is but a target, not hard limit. The actual
hard limit should be ~5-6k

we may use a lot of eursitics and any number of segementing tools to accomplish the task.

with more examoles, we might wanna intoduce more eurestics and tools.

let's update the bookkeeper with this in mind. Any questions / suggestions? Any other issues you see in
logs?

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
    index.ts               # main algorithm
    parse-blocks.ts        # content → TextBlock[]
    sentence-splitter.ts   # Intl.Segmenter for sentence boundaries
    rules/index.ts         # dialogue, paragraph rules
```

## Zod Enums

```ts
TextBlockKind: Paragraph | Heading | Dialogue | Blank
DialoguePosition: Start | Middle | End | Single
SplitToPagesErrorKind: NoPwd | NoContent | ParseFailed | DispatchFailed
```

## Segmentation Rules

1. **Dialogue preservation** - German dialogue patterns kept together:
   - Quotation marks: `"`, `»`, `„`
   - Attribution verbs: `sagte`, `fragte`, `rief`, `flüsterte`...

2. **Paragraph preservation** - never splits mid-paragraph

3. **Sentence splitting** - uses `Intl.Segmenter('de', {granularity: 'sentence'})`:
   - Applied when paragraph block would exceed target size
   - Finds natural sentence boundaries for cleaner page breaks
   - Only paragraphs split; dialogue/heading/blank blocks unchanged

4. **Size targets** (configurable):
   - Target: ~3000 chars
   - Max: ~5000 chars
   - Min content for split: ~1500 chars

## Behavior

- **Normal files**: Creates folder + codex + page files, trashes original
- **Short files**: Adds `noteType: Page` frontmatter only, no folder
- **Name conflicts**: Uses `duplicate-name-resolver.ts` (e.g., `Aschenputtel 1/`)

## Page Metadata

All page files get YAML frontmatter via `note-metadata-manager`:
```yaml
---
noteType: Page
status: false
---
```
- `status: false` = NotStarted, `status: true` = Done
- Uses `internalToFrontmatter()` for consistent YAML generation

## Command

Registered as `split-to-pages` in main.ts. Invokable via command palette: "Split file into pages"

## Integration

- Uses `VaultActionManager.dispatch()` for atomic file operations
- Uses `note-metadata-manager` for frontmatter serialization
- Codex follows existing `__-Suffix` naming convention
- Pages are regular ScrollNodes in LibraryTree
- Existing healing works automatically