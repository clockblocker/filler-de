# Textfresser E2E driver

This directory contains the test-only Obsidian driver source artifact. The
outer E2E runner bundles `dist/main.js` and `dist/protocol.js` into one
self-contained plugin entrypoint, installs it in the test vault, and writes
this `data.json`:

```json
{ "protocol": 1, "sessionId": "<runner-owned-session-id>" }
```

The plugin exposes one command:

```text
textfresser-e2e request=<unpadded-base64url-json>
```

It never evaluates caller-provided JavaScript. The decoded request is a typed
envelope:

```json
{
  "protocol": 1,
  "sessionId": "run-123",
  "requestId": "request-1",
  "method": "status",
  "params": {}
}
```

Call `ready` first and copy the returned top-level `instanceId` and
`generation` into `expectedInstanceId` and `expectedGeneration` for
`beginScenario`, `act`, and `cleanupSession`. Reusing a `requestId` with the
same request returns the cached response; reusing it for a different request
fails without executing either request again.

`beginScenario` creates
`E2E/<sessionId>/<scenarioId>/Library`, seeds its fixtures, and points
Textfresser at that isolated library. Fixture and action paths are relative to
the library by default. Use `"scope": "scenario"` only for a file that belongs
beside the library. Traversal and absolute paths are rejected before any Vault
API is called.

Supported methods are `status`, `ready`, `beginScenario`, `act`, `settle`,
`snapshot`, `modifications`, `diagnostics`, `dictionary`, and
`cleanupSession`. `dictionary` returns the vault-root `Worter/` notes by
vault path, read-only.
`beginScenario` accepts `"observeModifications": { "path": "<folder>" }` to
record Textfresser's VAM Markdown modify observations below that
library-relative folder; `modifications` settles and returns them. It also
installs a scripted jev in Textfresser's dumgen for the whole scenario, from
`"dumgen": { "jev": { "<question id>": "<Choice option>" | <Noul> } }` or
empty, with Luna's answers by stage under `"luna": { "<stage>": [{ "when"?:
"<input text>", "output": … }] }`, and `cleanupSession` removes it, so no
scenario reaches a provider; `status` counts its requests under
`dumgenRequests`. `"resetDictionary": true` moves `Worter/`, and the `Worter backup …/` folders and `Dictionary reset ….md` reports a dictionary reset leaves at the vault root, to Obsidian's trash first, and
only in a vault whose config folder holds a `textfresser-e2e-vault` marker. `"newNotesInDictionary": true` sets the vault's
`newFileLocation` to `folder` and `newFileFolderPath` to `Worter`, creating
that folder, for the scenario. `cleanupSession` restores that vault config and
every setting `beginScenario`'s `settings` replaced.
`act` supports `create`, `modify`, `rename`, `delete`, and the narrow
`splitToPages`, `splitInBlocks`, `classify`, `wrapLink`, `followLink`,
`pageNavigation`, `toggleCodexEntry`, `openDictionaryReset`, `dryRunDictionaryReset` and `restartLibrarian` Textfresser interactions; `create` also accepts
`"entryType": "folder"`. `classify` selects its `selection`, which must occur
exactly once in the file, and runs the Classify command; `status` then
reports, under `classify`, what that Classify handed to the resolver port.
`wrapLink` wraps its `selection`, which must occur exactly once on one line,
in `[[ ]]` with two editor transactions, as Obsidian's bracket auto-pair
does, waits up to two seconds for Textfresser to answer the completed link,
and saves the note. `followLink` calls `Workspace.openLinkText` with its
`linkpath`, which the note must hold as `[[<linkpath>]]` or
`[[<linkpath>|…]]`. After `classify` and `followLink` settle, the
driver saves the active editor if it differs from the note on disk, since
Textfresser writes into an open note through its editor, and settles once
more. `openDictionaryReset` takes no path: it runs the "Reset dictionary from old
notes…" command, waits for its modal (or its failure notice), and closes the
modal again, clicking nothing in it; `status` then reports what it showed
under `dictionaryReset`. `dryRunDictionaryReset` runs the command, clicks
Dry run and waits for the report, and with `"execute": true` clicks Execute…
on the report and Execute in the confirmation and waits for the run to end;
it closes every reset modal afterwards, and `status` reports the report's
buttons, key warning and Execute outcome under `dictionaryResetRun`.
`restartLibrarian` takes no path: it runs the "Restart Librarian" command and
settles once the Librarian has rescanned and healed the library again.
`beginScenario` also takes `"dictionaryFixture": [{ "path", "content" }]`,
notes written below the fresh `Worter/` (it needs `"resetDictionary":
true`), and `"dumgen": { "keyCheck": { "OpenAI"?: { "status", "body"? },
"TypeSafe"?: … } }`, how each scripted provider answers Textfresser's key
check (200 when absent). File content uses UTF-8 by default or canonical
padded base64 with `"encoding": "base64"`.

Run the transport and confinement tests directly:

```bash
bun test tests/obsidian-e2e/driver/protocol.test.ts
```
