import { describe, expect, it, mock } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
	TreeNodeStatus,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VamScanError,
	VamVaultIoError,
	type VaultScanReadableMdPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { buildInitialCreateActions } from "../../../src/commanders/librarian/init/build-initial-actions";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

mock.module("../../../src/global-state/global-state", () => ({
	getParsedUserSettings: () => defaultSettingsForUnitTests,
}));

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

function readableScroll(
	read: VaultScanReadableMdPath["read"],
): VaultScanReadableMdPath {
	return {
		basename: "Story",
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts: ["Library"],
		read,
	};
}

describe("Librarian Effect helpers", () => {
	it("records partial scan diagnostics and starts from successful entries", async () => {
		const diagnostic = new VamScanError({
			cause: new Error("nested folder unavailable"),
			operation: "scanFolder",
			path: "Library/Unavailable",
		});
		let subscriptions = 0;
		const librarian = new Librarian(
			makeLibrarianVam(
				Effect.succeed({
					counts: {
						folderCount: 2,
						markdownFileCount: 0,
						otherFileCount: 0,
					},
					diagnostics: [diagnostic],
					entries: [],
					kind: "Partial",
				}),
				() => {
					subscriptions += 1;
				},
			),
		);

		await Effect.runPromise(librarian.init());

		expect(librarian.getHealer()).not.toBeNull();
		expect(librarian._debugLastScanDiagnostics).toEqual([diagnostic]);
		expect(subscriptions).toBe(1);
		await Effect.runPromise(librarian.unsubscribe());
	});

	it("fails startup without creating an empty model when the root scan fails", async () => {
		const scanFailure = new VamScanError({
			cause: new Error("missing root"),
			operation: "scanRoot",
			path: "Library",
		});
		let subscriptions = 0;
		const librarian = new Librarian(
			makeLibrarianVam(Effect.fail(scanFailure), () => {
				subscriptions += 1;
			}),
		);

		const exit = await Effect.runPromiseExit(librarian.init());

		expect(exit._tag).toBe("Failure");
		expect(librarian.getHealer()).toBeNull();
		expect(librarian._debugLastScanDiagnostics).toEqual([]);
		expect(subscriptions).toBe(0);
	});

	it("defers initial markdown reads and extracts completed status", async () => {
		let reads = 0;
		const program = buildInitialCreateActions(
			[
				readableScroll(() => {
					reads += 1;
					return Effect.succeed("---\nstatus: Done\n---\nBody");
				}),
			],
			codecs,
		);

		expect(Effect.isEffect(program)).toBe(true);
		expect(reads).toBe(0);

		const { createActions } = await Effect.runPromise(program);

		expect(reads).toBe(1);
		expect(createActions).toHaveLength(1);
		expect(createActions[0]?.initialStatus).toBe(TreeNodeStatus.Done);
	});

	it("defaults unreadable markdown status to NotStarted", async () => {
		const { createActions } = await Effect.runPromise(
			buildInitialCreateActions(
				[
					readableScroll(() =>
						Effect.fail(
							new VamVaultIoError({
								cause: new Error("unreadable"),
								operation: "read",
								path: "Library/Story.md",
							}),
						),
					),
				],
				codecs,
			),
		);

		expect(createActions).toHaveLength(1);
		expect(createActions[0]?.initialStatus).toBe(
			TreeNodeStatus.NotStarted,
		);
	});

});

function makeLibrarianVam(
	scan: ReturnType<LibrarianVam["scan"]>,
	onSubscribe: () => void,
): LibrarianVam {
	return {
		cd: () => Effect.void,
		dispatch: () => Effect.void,
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () => scan,
		subscribeToBulk: () =>
			Effect.sync(() => {
				onSubscribe();
				return { close: Effect.void };
			}),
	};
}
