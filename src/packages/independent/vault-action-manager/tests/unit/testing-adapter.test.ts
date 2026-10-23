/**
 * `testing.whenSettled()` returns only once each file VAM's settled
 * dispatches created is queryable through the vault, as Obsidian can report
 * and index a new file after its write resolved.
 */
import { describe, expect, it } from "bun:test";
import {
	createVaultActionManager,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { TAbstractFile } from "obsidian";
import { makeVaultHarness } from "./helpers/vault-harness";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;

type HarnessVault = {
	getAbstractFileByPath: (path: string) => TAbstractFile | null;
	on: (name: string, callback: (file: TAbstractFile) => void) => unknown;
};

describe("VaultActionManagerTestingAdapter.whenSettled", () => {
	it("waits until a file the dispatch created is queryable", async () => {
		const harness = makeVaultHarness();
		harness.addFile("Worter/Hund.md", "# Hund");
		const vault = harness.app.vault as unknown as HarnessVault;
		// The harness reports no create, so the test reports it late, as
		// Obsidian's file watcher can.
		const listeners = new Map<string, (file: TAbstractFile) => void>();
		const on = vault.on;
		vault.on = (name, callback) => {
			listeners.set(name, callback);
			return on(name, callback);
		};
		const { dispose, manager, testing } = createVaultActionManager(
			harness.app,
		);
		const path = "Worter/Katze.md";
		await Effect.runPromise(manager.startListening());
		await Effect.runPromise(manager.subscribeToBulk(() => Effect.void));
		await Effect.runPromise(
			manager.dispatch(
				[
					{
						kind: VaultActionKind.UpsertMdFile,
						payload: { content: "# Katze", splitPath: md(path) },
					},
				],
				{ caller: "test" },
			),
		);

		// The new file stays unindexed for its next three lookups.
		const lookUp = vault.getAbstractFileByPath;
		const created = lookUp(path);
		let unindexedLookups = 3;
		vault.getAbstractFileByPath = (each) => {
			if (each === path && unindexedLookups > 0) {
				unindexedLookups--;
				return null;
			}
			return lookUp(each);
		};

		const settled = Effect.runPromise(testing.whenSettled());
		setTimeout(() => {
			if (created) listeners.get("create")?.(created);
		}, 20);
		await settled;

		expect(unindexedLookups).toBe(0);
		await Effect.runPromise(dispose);
	});
});
