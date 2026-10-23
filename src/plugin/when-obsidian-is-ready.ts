import { Effect } from "effect";
import type { App } from "obsidian";

/**
 * Ends once Obsidian has laid out the workspace and indexed the vault, and
 * 300 ms more. Interrupted, it stops listening for the index.
 */
export const whenObsidianIsReady = Effect.fn("whenObsidianIsReady")(function* (
	app: App,
) {
	const { metadataCache, vault, workspace } = app;
	if (!workspace.layoutReady)
		yield* Effect.callback<void>((resume) => {
			// Obsidian keeps no handle to unregister this; a late call
			// after an interruption resumes nothing.
			workspace.onLayoutReady(() => resume(Effect.void));
		});
	// Initial metadata indexing fires `resolved` once per app session.
	if (!vault.getRoot())
		yield* Effect.callback<void>((resume) => {
			const ref = metadataCache.on("resolved", () => {
				metadataCache.offref(ref);
				resume(Effect.void);
			});
			return Effect.sync(() => metadataCache.offref(ref));
		});
	yield* Effect.sleep("300 millis");
});
