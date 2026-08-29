# VAM Effect migration record

Status: Complete.

Related decision:

- [ADR-0005: Use one Effect runtime inside VAM](../../../docs/adr/0005-use-one-effect-runtime-inside-vam.md)

## Result

The Vault Action Manager (VAM) now exposes environment-free Effects from the package root.

The migration:

- created one managed VAM runtime;
- added typed setup, I/O, planning, dispatch, subscription, and shutdown errors;
- moved vault and active-editor I/O behind two ports;
- moved Dispatch Batch coordination to `Queue` and `Deferred`;
- moved Bulk Vault Event delivery to `PubSub`;
- moved event timing and Self Event expiry to Effect `Clock`;
- added scoped listener and fiber cleanup;
- removed the Promise and Neverthrow compatibility facade;
- kept pure planning and codec functions as ordinary TypeScript.

The plugin runs VAM Effects and owns disposal. VAM consumers do not create another runtime.

## Preserved behavior

- Dispatch Batches run in first-in, first-out order.
- Actions inside one batch run in dependency order.
- A batch can apply partially if a later action fails.
- Self Events do not become user intent.
- The active editor and background vault keep separate adapters.
- Persisted notes and vault paths did not change.

## Lifecycle

Shutdown:

1. Closes subscriptions.
2. Stops observation.
3. Finishes the active Dispatch Batch.
4. Fails queued submissions.
5. Disposes the runtime.

Repeated shutdown is safe.

## Verification

```bash
bun test src/packages/independent/vault-action-manager/tests/
bun run test:unit
bun run typecheck:vam
bun run typecheck:changed
bun run build
bun run test:obsidian-e2e
```

The production bundle increased from 3,677,505 bytes to 4,479,880 bytes during the migration.
