import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type BulkVaultEvent,
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	VamDispatchError,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
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

function mdFile(basename: string): SplitPathToMdFile {
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library", "Soup", "Ramen"],
	};
}

function scanned(basename: string): VaultScanPath {
	return { ...mdFile(basename), read: () => Effect.succeed("") };
}

function isRenameFrom(action: VaultAction, basename: string): boolean {
	return (
		action.kind === VaultActionKind.RenameMdFile &&
		action.payload.from.basename === basename
	);
}

/**
 * A vault holding `files`, whose batches fail, for the dispatches `fails`
 * picks, at their rename of `failing`: the rest of each batch runs, as VAM's
 * non-atomic dispatch does.
 */
function makeHarness(
	fails: (dispatchNumber: number) => boolean,
	failing = "Anchor",
) {
	const files = ["Anchor"];
	const dispatches: VaultAction[][] = [];
	const stops: string[] = [];
	let scans = 0;
	let emitBulk: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;
	const vam: LibrarianVam = {
		cd: () => Effect.void,
		dispatch: (actions) =>
			Effect.suspend(() => {
				dispatches.push([...actions]);
				const failed = actions.find((action) =>
					isRenameFrom(action, failing),
				);
				if (!failed || !fails(dispatches.length)) return Effect.void;
				return Effect.fail([
					new VamDispatchError({
						action: failed,
						cause: new Error("destination is locked"),
						operation: "executeAction",
					}),
				] as const);
			}),
		getActiveEditorContext: () => Effect.succeed(null),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.sync(() => {
				scans += 1;
				return {
					counts: {
						folderCount: 3,
						markdownFileCount: files.length,
						otherFileCount: 0,
					},
					diagnostics: [],
					entries: files.map(scanned),
					kind: "Complete" as const,
				};
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
		files,
		librarian: new Librarian(vam, {
			onStopped: (message) => stops.push(message),
		}),
		scans: () => scans,
		stops,
	};
}

function createdBulk(basename: string): BulkVaultEvent {
	const created = {
		kind: VaultEventKind.FileCreated,
		splitPath: mdFile(basename),
	} as const;
	return {
		debug: {
			collapsedCount: { creates: 1, deletes: 0, renames: 0 },
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 1,
			trueCount: { creates: 1, deletes: 0, renames: 0 },
		},
		events: [created],
		roots: [],
	};
}

describe("Librarian startup healing that partly fails", () => {
	it("rescans and recovers on its own when one startup heal fails once", async () => {
		const { dispatches, emitBulk, librarian, scans, stops } = makeHarness(
			(dispatchNumber) => dispatchNumber === 1,
		);

		await Effect.runPromise(librarian.init());

		expect(stops).toEqual([]);
		expect(scans()).toBe(2);
		expect(dispatches).toHaveLength(2);
		expect(
			dispatches[1]?.some((action) => isRenameFrom(action, "Anchor")),
		).toBeTrue();
		expect(librarian.getRecentReconciliationOutcomes(1)[0]?.recovery).toEqual({
			kind: "Resynchronized",
		});

		// The Librarian keeps healing later changes.
		dispatches.length = 0;
		await Effect.runPromise(emitBulk(createdBulk("Fresh")));
		expect(
			dispatches.flat().some((action) => isRenameFrom(action, "Fresh")),
		).toBeTrue();
		expect(stops).toEqual([]);

		await Effect.runPromise(librarian.unsubscribe());
	});

	it("stops after one rescan when the heal keeps failing, and tells the user which file and what to do", async () => {
		const { dispatches, librarian, scans, stops } = makeHarness(() => true);

		const exit = await Effect.runPromiseExit(librarian.init());

		expect(Exit.isFailure(exit)).toBeTrue();
		expect(scans()).toBe(2);
		expect(dispatches).toHaveLength(2);
		expect(stops).toHaveLength(1);
		const [message] = stops;
		expect(message).toContain(
			"The Librarian stopped: it could not heal the library at startup.",
		);
		expect(message).toContain("A rescan of the library did not fix it.");
		expect(message).toContain(
			"Library/Soup/Ramen/Anchor.md → Library/Soup/Ramen/Anchor-Ramen-Soup.md (destination is locked)",
		);
		expect(message).toContain('run "Restart Librarian"');
	});

	it("tells the user once when a later heal fails past its rescan", async () => {
		const { dispatches, emitBulk, files, librarian, stops } = makeHarness(
			() => true,
			"Fresh",
		);
		await Effect.runPromise(librarian.init());
		expect(stops).toEqual([]);
		const afterStartup = dispatches.length;

		// The rescan sees Fresh still unhealed, and its rename fails again.
		files.push("Fresh");
		await Effect.runPromise(emitBulk(createdBulk("Fresh")));
		await Effect.runPromise(emitBulk(createdBulk("Later")));

		expect(stops).toHaveLength(1);
		expect(stops[0]).toContain(
			"The Librarian stopped: it could not heal the library after a change.",
		);
		expect(stops[0]).toContain("A rescan of the library did not fix it.");
		expect(stops[0]).toContain("Library/Soup/Ramen/Fresh.md");
		// One batch for the change and one for its rescan; the next change
		// dispatches nothing.
		expect(dispatches.length - afterStartup).toBe(2);

		await Effect.runPromise(librarian.unsubscribe());
	});
});
