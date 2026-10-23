/**
 * The Librarian over the real Vault Action Manager, healing a folder rename
 * the user makes into a section move. The heal itself renames a folder, and
 * Obsidian reports that rename for every descendant; none of those reports
 * may reach the Librarian as a second user change.
 */
import { describe, expect, it } from "bun:test";
import {
	type BulkVaultEvent,
	createVaultActionManager,
	type SplitPathToFolder,
	splitPathCodec,
	type VaultAction,
	VaultActionKind,
	type VaultEvent,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianStop,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { fixedSettings } from "../../unit/common-utils/test-settings";

function folderAt(path: string): SplitPathToFolder {
	const splitPath = splitPathCodec.parse(path);
	if (splitPath.kind !== "Folder") throw new Error(`Not a folder: ${path}`);
	return splitPath;
}

function describeRoot(event: VaultEvent): string {
	return "from" in event
		? `${event.kind} ${splitPathCodec.format(event.from)} -> ${splitPathCodec.format(event.to)}`
		: `${event.kind} ${splitPathCodec.format(event.splitPath)}`;
}

/** The Librarian over real VAM, recording what crosses between them. */
async function startLibrarian(vault: ReturnType<typeof makeObsidianVault>) {
	const { dispose, manager, testing } = createVaultActionManager(vault.app);
	const bulks: BulkVaultEvent[] = [];
	const batches: VaultAction[][] = [];
	const stops: LibrarianStop[] = [];
	const vam: LibrarianVam = {
		cd: (...args) => manager.cd(...args),
		dispatch: (actions, caller) => {
			batches.push([...actions]);
			return manager.dispatch(actions, caller);
		},
		getActiveEditorContext: (...args) =>
			manager.getActiveEditorContext(...args),
		getOpenedContent: (...args) => manager.getOpenedContent(...args),
		mdPwd: (...args) => manager.mdPwd(...args),
		scanAndSubscribe: (folder, { onBulk }, options) =>
			manager.scanAndSubscribe(
				folder,
				{
					onBulk: (bulk) => {
						bulks.push(bulk);
						return onBulk ? onBulk(bulk) : Effect.void;
					},
				},
				options,
			),
	};
	const librarian = new Librarian(vam, {
		onStopped: (stop) => void stops.push(stop),
		settings: fixedSettings(),
	});
	await Effect.runPromise(manager.startListening());
	await Effect.runPromise(librarian.init());
	const settle = () => Effect.runPromise(testing.whenSettled());
	await settle();
	return {
		batches,
		bulks,
		manager,
		/** Forgets what startup sent and received. */
		reset: () => {
			bulks.length = 0;
			batches.length = 0;
			vault.trashed.length = 0;
		},
		settle,
		stop: async () => {
			await Effect.runPromise(librarian.unsubscribe());
			await Effect.runPromise(dispose);
		},
		stops,
	};
}

describe("Librarian section-move heal over real VAM", () => {
	it(
		"heals a folder renamed into a section move in one batch, and hears nothing back from it",
		async () => {
			const vault = makeObsidianVault({
				"Library/Recipe/Pie/Ingredients.md": "# Ingredients",
				"Library/Recipe/Pie/Result_picture.jpg": "x",
				"Library/Recipe/Pie/Steps.md": "# Steps",
				"Library/Recipe/Pie/Sub/Deep.md": "# Deep",
				"Library/Recipe/Pie/Sub/Inner/Deeper.md": "# Deeper",
			});
			const librarian = await startLibrarian(vault);
			try {
				expect(vault.files()).toContain(
					"Library/Recipe/Pie/Sub/Inner/__-Inner-Sub-Pie-Recipe.md",
				);
				librarian.reset();

				// `Fish-Pie` names the section `Fish` inside `Pie`.
				await vault.renameByHand(
					"Library/Recipe/Pie",
					"Library/Recipe/Fish-Pie",
				);
				await librarian.settle();

				// Only the user's rename reaches the Librarian. Its heal
				// renames `Fish-Pie` to `Pie/Fish`, and Obsidian's reports
				// for that folder's descendants are Self Events.
				expect(
					librarian.bulks.map((bulk) => bulk.roots.map(describeRoot)),
				).toEqual([
					["FolderRenamed Library/Recipe/Pie -> Library/Recipe/Fish-Pie"],
				]);
				expect(librarian.batches).toHaveLength(1);
				expect(librarian.stops).toEqual([]);

				// The heal trashes every stale Codex, nested ones included,
				// before it moves their folder away.
				expect(vault.trashed.sort()).toEqual([
					"Library/Recipe/Fish-Pie/Sub/Inner/__-Inner-Sub-Pie-Recipe.md",
					"Library/Recipe/Fish-Pie/Sub/__-Sub-Pie-Recipe.md",
					"Library/Recipe/Fish-Pie/__-Pie-Recipe.md",
				]);
				expect(vault.files()).toEqual([
					"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Result_picture-Fish-Pie-Recipe.jpg",
					"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Deep-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Inner/Deeper-Inner-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/Inner/__-Inner-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/Sub/__-Sub-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
					"Library/Recipe/Pie/__-Pie-Recipe.md",
					"Library/Recipe/__-Recipe.md",
					"Library/__-Library.md",
				]);
			} finally {
				await librarian.stop();
			}
		},
		// Settling waits out the Self Event TTL of paths Obsidian never reports.
		30_000,
	);

	it(
		"never hears, so never heals, a rename another VAM caller makes",
		async () => {
			const vault = makeObsidianVault({
				"Library/Recipe/Pie/Ingredients.md": "# Ingredients",
				"Library/Recipe/Pie/Steps.md": "# Steps",
			});
			const librarian = await startLibrarian(vault);
			try {
				librarian.reset();
				const before = vault.files();

				// The same rename as a user's section move, but dispatched:
				// the Librarian subscribes to external events only.
				await Effect.runPromise(
					librarian.manager.dispatch(
						[
							{
								kind: VaultActionKind.RenameFolder,
								payload: {
									from: folderAt("Library/Recipe/Pie"),
									to: folderAt("Library/Recipe/Fish-Pie"),
									updateLinks: false,
								},
							},
						],
						{ caller: "reset" },
					),
				);
				await librarian.settle();

				expect(librarian.bulks).toEqual([]);
				expect(librarian.batches).toEqual([]);
				expect(vault.files()).toEqual(
					before.map((path) =>
						path.replace("Library/Recipe/Pie/", "Library/Recipe/Fish-Pie/"),
					),
				);
			} finally {
				await librarian.stop();
			}
		},
		30_000,
	);
});
