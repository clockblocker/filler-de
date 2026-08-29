import { describe, expect, it, mock } from "bun:test";
import {
	type CodecError,
	type Codecs,
	makeBulkInterpreter,
	makeCodecRulesFromSettings,
	makeCodecs,
	TreeNodeStatus,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VamScanError,
	VamVaultIoError,
	VaultEventKind,
	type VaultScanPath,
	type VaultScanReadableMdPath,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { err } from "neverthrow";
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

	it("defers initial markdown reads and preserves explicit statuses", async () => {
		for (const status of [
			TreeNodeStatus.Done,
			TreeNodeStatus.NotStarted,
		]) {
			let reads = 0;
			const program = buildInitialCreateActions(
				[
					readableScroll(() => {
						reads += 1;
						return Effect.succeed(
							`---\nstatus: ${status}\n---\nBody`,
						);
					}),
				],
				codecs,
			);

			expect(Effect.isEffect(program)).toBe(true);
			expect(reads).toBe(0);

			const { createActions } = await Effect.runPromise(program);

			expect(reads).toBe(1);
			expect(createActions).toHaveLength(1);
			expect(createActions[0]?.initialStatus).toBe(status);
		}
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

	it("keeps startup and live Create translation equivalent", async () => {
		const cases: VaultScanPath[] = [
			{
				basename: "Story-Chapter",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library"],
				read: () => Effect.succeed(""),
			},
			{
				basename: "Story-Wrong-Suffix",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Parent", "Child"],
				read: () => Effect.succeed(""),
			},
			{
				basename: "Cover-Wrong",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["Library", "Assets"],
			},
		];
		const interpretBulk = makeBulkInterpreter(codecs);

		for (const scanPath of cases) {
			const startup = await Effect.runPromise(
				buildInitialCreateActions([scanPath], codecs),
			);
			const observedPath =
				scanPath.kind === SplitPathKind.MdFile
					? (({ read: _read, ...path }) => path)(scanPath)
					: scanPath;
			const live = interpretBulk({
				events: [
					{
						kind: VaultEventKind.FileCreated,
						splitPath: observedPath,
					},
				],
				roots: [],
			});

			expect(startup.createDiagnostics).toEqual([]);
			expect(live.createDiagnostics).toEqual([]);
			expect(startup.createActions).toHaveLength(1);
			expect(live.treeActions).toHaveLength(1);
			const startupAction = startup.createActions[0];
			const liveAction = live.treeActions[0];
			if (!startupAction || liveAction?.actionType !== "Create") {
				throw new Error("Expected equivalent Create actions");
			}
			expect(liveAction?.actionType).toBe(startupAction?.actionType);
			expect(liveAction?.targetLocator).toEqual(
				startupAction?.targetLocator,
			);
			expect(liveAction.observedSplitPath).toEqual(
				startupAction.observedSplitPath,
			);
			if (scanPath.kind === SplitPathKind.MdFile) {
				expect(startupAction?.initialStatus).toBe(
					TreeNodeStatus.NotStarted,
				);
				expect("initialStatus" in (liveAction ?? {})).toBe(false);
			}
		}
	});

	it("ignores generated Codexes consistently without reading them", async () => {
		let reads = 0;
		const codex = {
			basename: "__-Chapter",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Chapter"],
			read: () => {
				reads += 1;
				return Effect.succeed("");
			},
		} satisfies VaultScanReadableMdPath;
		const startup = await Effect.runPromise(
			buildInitialCreateActions([codex], codecs),
		);
		const { read: _read, ...observedPath } = codex;
		const live = makeBulkInterpreter(codecs)({
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: observedPath,
				},
			],
			roots: [],
		});

		expect(reads).toBe(0);
		expect(startup).toEqual({
			createActions: [],
			createDiagnostics: [],
		});
		expect(live.treeActions).toEqual([]);
		expect(live.createDiagnostics).toEqual([]);
	});

	it("surfaces equivalent invalid diagnostics without reading content", async () => {
		let reads = 0;
		const invalid = {
			basename: "",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
			read: () => {
				reads += 1;
				return Effect.succeed("");
			},
		} satisfies VaultScanReadableMdPath;
		const startup = await Effect.runPromise(
			buildInitialCreateActions([invalid], codecs),
		);
		const { read: _read, ...observedPath } = invalid;
		const live = makeBulkInterpreter(codecs)({
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: observedPath,
				},
			],
			roots: [],
		});

		expect(reads).toBe(0);
		expect(startup.createActions).toEqual([]);
		expect(live.treeActions).toEqual([]);
		expect(startup.createDiagnostics).toHaveLength(1);
		expect(live.createDiagnostics).toHaveLength(1);
		expect(live.createDiagnostics[0]?.kind).toBe(
			startup.createDiagnostics[0]?.kind,
		);
		expect(live.createDiagnostics[0]?.observedSplitPath).toEqual(
			startup.createDiagnostics[0]?.observedSplitPath,
		);
	});

	it("surfaces equivalent locator diagnostics without reading content", async () => {
		const locatorFailure: CodecError = {
			context: { input: "test" },
			kind: "LocatorError",
			message: "invalid locator input",
			reason: "InvalidSegmentId",
		};
		const failingLocator = (() =>
			err(
				locatorFailure,
			)) as Codecs["locator"]["canonicalSplitPathInsideLibraryToLocator"];
		const failingCodecs: Codecs = {
			...codecs,
			locator: {
				...codecs.locator,
				canonicalSplitPathInsideLibraryToLocator: failingLocator,
			},
		};
		let reads = 0;
		const invalid = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
			read: () => {
				reads += 1;
				return Effect.succeed("");
			},
		} satisfies VaultScanReadableMdPath;
		const startup = await Effect.runPromise(
			buildInitialCreateActions([invalid], failingCodecs),
		);
		const { read: _read, ...observedPath } = invalid;
		const live = makeBulkInterpreter(failingCodecs)({
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: observedPath,
				},
			],
			roots: [],
		});

		expect(reads).toBe(0);
		expect(startup.createActions).toEqual([]);
		expect(live.treeActions).toEqual([]);
		expect(startup.createDiagnostics).toEqual([
			expect.objectContaining({
				cause: locatorFailure,
				kind: "LocatorConstructionFailed",
			}),
		]);
		expect(live.createDiagnostics).toEqual(startup.createDiagnostics);
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
