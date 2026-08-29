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
`snapshot`, `diagnostics`, and `cleanupSession`. `act` supports `create`,
`modify`, `rename`, `delete`, and the narrow `splitToPages` Textfresser command;
`create` also accepts
`"entryType": "folder"`. File content uses UTF-8 by default or canonical
padded base64 with `"encoding": "base64"`.

Run the transport and confinement tests directly:

```bash
bun test tests/obsidian-e2e/driver/protocol.test.ts
```
