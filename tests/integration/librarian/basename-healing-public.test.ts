import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	type FileRenamedVaultEvent,
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	type VaultAction,
	VaultActionKind,
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
});
