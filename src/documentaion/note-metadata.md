# Note-metadata facility

`src/stateless-helpers/note-metadata/` stores typed, versioned metadata per
note. The Library keeps Reading Status and note kinds there. The dictionary
will keep Lemma and Reading data there too (#112, #113), replacing inline
markers. Library code reaches it through `library-core`'s
`internal/root/note-metadata.ts` re-export.

## Formats

The "Hide metadata" setting picks the format every write uses.

**Hidden** (setting on). An invisible section ends the file:

```text
<body, trailing whitespace trimmed>
<20 newlines of padding>
<section id="textfresser_meta_keep_me_invisible">
{"status":"Done","dictionary":{"schemaVersion":1,...}}
</section>
```

- **Anchored.** The section counts only when it ends the file, trailing
  whitespace aside. A section-shaped string anywhere else, or a section
  followed by text, is visible content and is never read as data. If the
  user types after the section, the next write appends a new section and
  leaves the old one in the body.
- **Escaped.** The payload is one line of JSON. Inside strings, `[`, `%`,
  `<` and `#` are written as `[`, `%`, `<` and `#`, so
  no value makes a wikilink, an embed, an Obsidian comment, a tag, or a
  closing `</section>`. Between strings, nested array brackets are written
  `[ [`, so `[[` never appears. All of this is plain JSON, and sections
  written before the escaping still parse.
- **Canonical.** Every write puts the section after the body's trimmed end
  plus exactly 20 newlines. This is what stops empty Scrolls growing (below).

**Frontmatter** (setting off). The data shares the YAML frontmatter with the
user's own properties. It is read with Obsidian's `parseYaml` and written
with `stringifyYaml`, the YAML library `processFrontMatter` uses, so nested
objects and arrays survive.

- `processFrontMatter` itself is not used. It works on a `TFile`, so it
  can't run inside a VAM transform or the dictionary store's
  compare-and-swap.
- A write keeps the user's properties and their order. A block whose
  mapping didn't change is kept byte for byte, comments included; a changed
  one is re-serialized, as `processFrontMatter` does.
- Frontmatter that isn't a readable YAML mapping is never overwritten. A
  write in this format throws `NoteMetadataError` instead.
- Obsidian indexes `[[…]]` inside property values. In this format, links in
  dictionary data become real links. The hidden format is the one to use for
  dictionary data.

Unit tests mock `parseYaml` and `stringifyYaml` with the `yaml` package,
called with the options Obsidian 1.14.4 uses (`tests/unit/setup.ts`).

## Documents and namespaces

Each format holds one **metadata document** per note: a JSON object. Each
owner of metadata reads and writes its own part of it through a
**namespace** (`MetadataNamespace<T>`), and never touches another
namespace's keys.

- **Nested namespaces** (`defineNestedNamespace`) keep one object under their
  key, the same way in both formats:

  ```json
  { "dictionary": { "schemaVersion": 2, "lemma": "...", "readings": [] } }
  ```

  A spec gives `name`, `key`, the current `version`, the current version's
  zod `schema` (without `schemaVersion`), and `migrations`, where
  `migrations[n]` turns version `n` data into version `n + 1`. Reading
  checks the version, runs the migrations, then validates with the schema:
  - missing `schemaVersion`: `MissingVersion`;
  - a version above `version`: `NewerVersion`;
  - a failing migration: `MigrationFailed`;
  - failed validation: `SchemaMismatch`.

  Writing validates the value against the schema and records the current
  version. Values must be JSON data: no `undefined` in arrays, no `Date`s,
  no `Map`s.
- **`LibraryMetadata`**, the Library's namespace, predates namespaces. Its
  keys sit at the top level, as they always have: hidden
  `{"status":"Done","noteKind":"Page"}`, frontmatter `status: true` (a
  checkbox), `noteKind: Page`, and `fileType: Codex` on Codexes. This layout
  is version 1 and records no `schemaVersion`, so no Library note changes on
  disk. A later version would move the data under a `library` key, with a
  migration that reads the top-level keys. `status` is written only when the
  caller gives it, so Codexes no longer get `status: false`.

## API

Everything is on `noteMetadataHelper`. Each transform is a pure, synchronous
`(content) => content` function (`MetadataTransform`), and each is
idempotent: applied to its own output, it gives the same bytes. `format`
defaults to the one the setting selects when the transform is built.

| Operation | What it does |
| --- | --- |
| `read(content, ns, prefer?)` | The value, or null when absent or unreadable. |
| `inspect(content, ns, prefer?)` | `Absent`, `Valid` with its format, or `Invalid` with a `MetadataIssue` and its format. |
| `write(ns, value, format?)` | Replaces the namespace's data in `format` and removes it from the other format. |
| `update(ns, change, format?)` | Reads, applies `change(current \| null)`, writes; returning null removes. Throws `NoteMetadataError` rather than overwrite data it can't read. |
| `remove(ns)` | Removes the namespace from both formats. Drops the hidden section once it is empty. |
| `mapBody(change)` | Rewrites the visible body and keeps all metadata. Used by the backlink transforms. |
| `convertNote(content, target, namespaces)` / `convertFormat(...)` | Moves the namespaces into `target`; the report variant lists what moved and what stayed. |
| `strip`, `body`, `stripOnlyFrontmatter`, `findSectionStart` | Visible text, without metadata. |
| `toggleStatus(checked)` | The Library's Reading Status update. |

**Reading across formats.** `read` and `inspect` try `prefer` first (by
default the current format), then the other one. A note that hasn't been
migrated yet after a toggle still reads. Each write then moves the namespace
into the current format.

**Errors.** `NoteMetadataError` has a `namespace` and one of these reasons:
`InvalidValue` (the value breaks the schema), `UnreadableFrontmatter`, or
`UnreadableData` (`update` found an issue). Thrown inside `Vault.process`, it
aborts that write.

### Inside the dictionary store's compare-and-swap

The transforms are plain functions, so the store computes the next content
from the content it read and swaps it in only if the file still holds that
content (`dictionary/src/store.ts`, `compareAndSwap`):

```ts
const Lemma = defineNestedNamespace({
	key: "dictionary",
	migrations: {},
	name: "dictionary",
	schema: LemmaNoteDataSchema,
	version: 1,
});

const next = noteMetadataHelper.write(Lemma, data)(expected);
transform: compareAndSwap(path, expected, next);
```

Use `inspect` to tell a note without dictionary data (`Absent`) from one
whose data can't be read (`Invalid`, for example `NewerVersion`), and
quarantine the second kind instead of overwriting it.

## Toggling "Hide metadata"

`saveSettings` runs `migrateMetadataFormat`
(`src/commanders/note-metadata-migration/`) before it reinitializes the
Librarian. Each scope gives a folder and the namespaces its notes hold; today
the only scope is the Library root with `LibraryMetadata`. Every Markdown note
in it that carries their data in the other format is rewritten. The transform
runs again inside `Vault.process`, so a concurrent edit is kept. A Notice
reports the counts, and the console lists every skipped or failed note.

- **Hidden → frontmatter.** The namespaces move to frontmatter. Keys in the
  section that no namespace claims (legacy `prevPageIdx`, for example) move
  with them, unless the frontmatter already has a property of that name. The
  section is then dropped.
- **Frontmatter → hidden.** Only the namespaces' keys move. Every other
  frontmatter property belongs to the user and stays. A frontmatter block
  left empty is dropped.
- A note whose frontmatter can't be parsed is left as it is and reported as
  skipped.

When the dictionary moves onto the facility, #112/#113 add a scope for
`Worter/` with its namespaces.

## Blank-line growth (#107)

Empty Scrolls used to gain two blank lines on every backlink pass:

- the backlink transform recomposed `frontmatter + upsert(body) + section`;
- `upsert` ends with `\n\n`;
- the old section pattern, `\n*<section…>…</section>\n*`, then absorbed those
  newlines into the section it preserved.

A pass runs for every Scroll on each Librarian startup. It runs again on each
recovery, because recovery re-runs the startup reconciliation, and on each
re-initialization after a settings change. `mapBody` now writes the section
canonically, so the pass is idempotent. The next startup collapses already
bloated notes back to the 20-line padding.
