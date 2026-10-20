import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	type FileRenamedVaultEvent,
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
	type VaultEvent,
	VaultEventKind,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

function scroll(basename: string): VaultScanPath {
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "Soup", "Ramen"],
		read: () => Effect.succeed(""),
	};
}

function nestedScrollRenamedWithoutItsSuffix(): BulkVaultEvent {
	const from: SplitPathToMdFile = {
		basename: "OldScroll-Ramen-Soup",
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "Soup", "Ramen"],
	};
	const renamed: FileRenamedVaultEvent = {
		from,
		kind: VaultEventKind.FileRenamed,
		to: {
			...from,
			basename: "NewScroll",
		},
	};

	return {
		debug: {
			collapsedCount: { creates: 0, deletes: 0, renames: 1 },
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: 1 },
			startedAt: 1,
			trueCount: { creates: 0, deletes: 0, renames: 1 },
		},
		events: [renamed],
		roots: [renamed],
	};
}

function makeHarness() {
	const dispatches: VaultAction[][] = [];
	let emitBulk: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;
	const vam: LibrarianVam = {
		cd: () => Effect.void,
		dispatch: (actions) =>
			Effect.sync(() => {
				dispatches.push([...actions]);
			}),
		getActiveEditorContext: () => Effect.succeed(null),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.succeed({
				counts: {
					folderCount: 3,
					markdownFileCount: 1,
					otherFileCount: 0,
				},
				diagnostics: [],
				entries: [scroll("OldScroll-Ramen-Soup")],
				kind: "Complete",
			}),
		subscribeToBulk: (handler) =>
			Effect.sync(() => {
				emitBulk = handler;
				return { close: Effect.void };
			}),
	};

	return {
		dispatches,
		emitBulk: (bulk: BulkVaultEvent) => emitBulk(bulk),
		librarian: new Librarian(vam),
	};
}

describe("Librarian basename healing through its public event seam", () => {
	it("restores the Section suffix after a nested Scroll is renamed by Core Name", async () => {
		const { dispatches, emitBulk, librarian } = makeHarness();
		await Effect.runPromise(librarian.init());
		dispatches.length = 0;

		await Effect.runPromise(emitBulk(nestedScrollRenamedWithoutItsSuffix()));

		const finalPathHealing = dispatches
			.flat()
			.find(
				(action) =>
					action.kind === VaultActionKind.RenameMdFile &&
					action.payload.from.basename === "NewScroll",
			);
		expect(finalPathHealing).toEqual({
			kind: VaultActionKind.RenameMdFile,
			payload: {
				from: {
					basename: "NewScroll",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "Soup", "Ramen"],
				},
				to: {
					basename: "NewScroll-Ramen-Soup",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "Soup", "Ramen"],
				},
			},
		});

		await Effect.runPromise(librarian.unsubscribe());
	});

	it("does not heal again a create that startup reconciliation already healed", async () => {
		// The file was created just before the scan, so its create event
		// reaches the Librarian only while startup reconciliation runs.
		const anchor = mdFile("Anchor");
		const { dispatches, files } = await initWithBulksDuringStartup(
			["Anchor"],
			[bulkOf({ kind: VaultEventKind.FileCreated, splitPath: anchor })],
		);

		expect(renamesFrom(dispatches, "Anchor")).toEqual([
			{
				kind: VaultActionKind.RenameMdFile,
				payload: { from: anchor, to: mdFile("Anchor-Ramen-Soup") },
			},
		]);
		expect([...files]).toEqual(["Library/Soup/Ramen/Anchor-Ramen-Soup"]);
	});

	it("heals a file created and then renamed while startup reconciliation runs", async () => {
		const { dispatches } = await initWithBulksDuringStartup(
			["Anchor-Ramen-Soup"],
			[
				bulkOf({
					kind: VaultEventKind.FileCreated,
					splitPath: mdFile("Fresh-Ramen-Soup"),
				}),
				bulkOf({
					from: mdFile("Fresh-Ramen-Soup"),
					kind: VaultEventKind.FileRenamed,
					to: mdFile("Late"),
				}),
			],
		);

		expect(renamesFrom(dispatches, "Late")).toEqual([
			{
				kind: VaultActionKind.RenameMdFile,
				payload: { from: mdFile("Late"), to: mdFile("Late-Ramen-Soup") },
			},
		]);
	});
});

function mdFile(basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "Soup", "Ramen"],
	};
}

function bulkOf(event: VaultEvent): BulkVaultEvent {
	const isRename = event.kind === VaultEventKind.FileRenamed;
	const count = {
		creates: event.kind === VaultEventKind.FileCreated ? 1 : 0,
		deletes: 0,
		renames: isRename ? 1 : 0,
	};
	return {
		debug: {
			collapsedCount: count,
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: count.renames },
			startedAt: 1,
			trueCount: count,
		},
		events: [event],
		roots: isRename ? [event] : [],
	};
}

function renamesFrom(dispatches: VaultAction[][], basename: string) {
	return dispatches
		.flat()
		.filter(
			(action) =>
				action.kind === VaultActionKind.RenameMdFile &&
				action.payload.from.basename === basename,
		);
}

/**
 * Starts a Librarian over a Library holding `scanned` and delivers `bulks`
 * during the first startup dispatch, as debounced Bulks would arrive.
 */
async function initWithBulksDuringStartup(
	scanned: readonly string[],
	bulks: readonly BulkVaultEvent[],
) {
	const pathOf = (splitPath: SplitPathToMdFile) =>
		[...splitPath.pathParts, splitPath.basename].join("/");
	const files = new Set(scanned.map((basename) => pathOf(mdFile(basename))));
	const dispatches: VaultAction[][] = [];
	let emitBulk: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;
	let delivered = false;
	const vam: LibrarianVam = {
		cd: () => Effect.void,
		dispatch: (actions) =>
			Effect.gen(function* () {
				if (!delivered) {
					delivered = true;
					for (const bulk of bulks) {
						yield* Effect.orDie(emitBulk(bulk));
					}
				}
				dispatches.push([...actions]);
				for (const action of actions) {
					if (action.kind !== VaultActionKind.RenameMdFile) continue;
					if (!files.delete(pathOf(action.payload.from))) continue;
					files.add(pathOf(action.payload.to));
				}
			}),
		getActiveEditorContext: () => Effect.succeed(null),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.succeed({
				counts: {
					folderCount: 3,
					markdownFileCount: scanned.length,
					otherFileCount: 0,
				},
				diagnostics: [],
				entries: scanned.map(scroll),
				kind: "Complete",
			}),
		subscribeToBulk: (handler) =>
			Effect.sync(() => {
				emitBulk = handler;
				return { close: Effect.void };
			}),
	};
	const librarian = new Librarian(vam);

	await Effect.runPromise(librarian.init());
	await Effect.runPromise(librarian.unsubscribe());
	expect(delivered).toBe(true);
	return { dispatches, files };
}
