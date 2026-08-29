import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { TreeNodeStatus } from "@textfresser/library-core";
import {
	type BulkVaultEvent,
	MD,
	SplitPathKind,
	type SplitPathToMdFile,
	VamDispatchError,
	VamPlanningError,
	VamVaultIoError,
	type VaultAction,
	VaultActionKind,
	VaultEventKind,
	type VaultScanPath,
	type VaultScanResult,
} from "@textfresser/vault-action-manager";
import { Deferred, Effect, Fiber, Result } from "effect";
import {
	Librarian,
	type LibrarianVam,
} from "../../../src/commanders/librarian/librarian";
import {
	type SplitToPagesError,
	splitToPagesAction,
} from "../../../src/commanders/librarian/pages/split-to-pages-action";
import type { SegmentationConfig } from "../../../src/commanders/librarian/pages/types";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import { toShape } from "../../unit/librarian/library-tree/tree-test-helpers";

type DispatchFailure = Effect.Error<ReturnType<LibrarianVam["dispatch"]>>;
type NavigationFailure = Effect.Error<ReturnType<LibrarianVam["cd"]>>;
type ScanFailure = Effect.Error<ReturnType<LibrarianVam["scan"]>>;

const SPLIT_CONFIG: SegmentationConfig = {
	maxPageSizeChars: 80,
	minContentSizeChars: 1,
	preserveDialogues: false,
	preserveParagraphs: false,
	targetPageSizeChars: 55,
};

const LONG_CONTENT = Array.from(
	{ length: 10 },
	(_, index) => `Sentence ${index} carries enough words to form a page.`,
).join(" ");

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

function scroll(
	pathParts: string[],
	basename: string,
	content = "",
): VaultScanPath {
	return {
		basename,
		extension: MD,
		kind: SplitPathKind.MdFile,
		pathParts,
		read: () => Effect.succeed(content),
	};
}

function createdScrollBulk(
	pathParts: string[],
	basename: string,
): BulkVaultEvent {
	return {
		debug: {
			collapsedCount: { creates: 1, deletes: 0, renames: 0 },
			endedAt: 2,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 1,
			trueCount: { creates: 1, deletes: 0, renames: 0 },
		},
		events: [
			{
				kind: VaultEventKind.FileCreated,
				splitPath: {
					basename,
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts,
				},
			},
		],
		roots: [],
	};
}

function makeHarness(input: {
	content?: string;
	files: VaultScanPath[];
	sourcePath: SplitPathToMdFile;
}) {
	const dispatches: VaultAction[][] = [];
	const navigation: SplitPathToMdFile[] = [];
	const order: string[] = [];
	let scannedFiles = input.files;
	let dispatchImpl: (
		actions: readonly VaultAction[],
	) => Effect.Effect<void, DispatchFailure> = () => Effect.void;
	const currentScan = (): VaultScanResult => ({
		counts: {
			folderCount: 1,
			markdownFileCount: scannedFiles.filter(
				(path) => path.kind === SplitPathKind.MdFile,
			).length,
			otherFileCount: scannedFiles.filter(
				(path) => path.kind === SplitPathKind.File,
			).length,
		},
		diagnostics: [],
		entries: scannedFiles,
		kind: "Complete",
	});
	let scanImpl: () => Effect.Effect<VaultScanResult, ScanFailure> = () =>
		Effect.succeed(currentScan());
	let navigationImpl: (
		path: SplitPathToMdFile,
	) => Effect.Effect<void, NavigationFailure> = () => Effect.void;
	let emitBulk: (bulk: BulkVaultEvent) => Effect.Effect<void, unknown> = () =>
		Effect.void;

	const vam: LibrarianVam = {
		cd: (path) =>
			Effect.sync(() => {
				order.push("cd");
				navigation.push(path);
			}).pipe(Effect.andThen(navigationImpl(path))),
		dispatch: (actions) =>
			Effect.sync(() => {
				order.push("dispatch");
				dispatches.push([...actions]);
			}).pipe(Effect.andThen(dispatchImpl(actions))),
		getActiveEditorContext: () =>
			Effect.succeed({
				content: input.content ?? LONG_CONTENT,
				currentLine: input.content ?? LONG_CONTENT,
				cursor: { ch: 0, line: 0 },
				selection: {
					selectionStartInBlock: null,
					splitPathToFileWithSelection: input.sourcePath,
					surroundingRawBlock: "",
					text: null,
				},
				splitPath: input.sourcePath,
			}),
		getOpenedContent: () => Effect.succeed(input.content ?? LONG_CONTENT),
		mdPwd: () => Effect.succeed(input.sourcePath),
		scan: () => scanImpl(),
		subscribeToBulk: (handler) =>
			Effect.sync(() => {
				emitBulk = handler;
				return { close: Effect.void };
			}),
	};
	const librarian = new Librarian(vam);

	return {
		dispatches,
		emitBulk: (bulk: BulkVaultEvent) => emitBulk(bulk),
		librarian,
		navigation,
		order,
		setDispatch: (
			implementation: (
				actions: readonly VaultAction[],
			) => Effect.Effect<void, DispatchFailure>,
		) => {
			dispatchImpl = implementation;
		},
		setNavigation: (
			implementation: (
				path: SplitPathToMdFile,
			) => Effect.Effect<void, NavigationFailure>,
		) => {
				navigationImpl = implementation;
		},
		setScan: (
			implementation: () => Effect.Effect<VaultScanResult, ScanFailure>,
		) => {
			scanImpl = implementation;
		},
		setScanFiles: (files: VaultScanPath[]) => {
			scannedFiles = files;
		},
		vam,
	};
}

function mdPath(path: SplitPathToMdFile): string {
	return `${[...path.pathParts, path.basename].join("/")}.${path.extension}`;
}

function actionsOfKind<K extends VaultAction["kind"]>(
	dispatch: readonly VaultAction[],
	kind: K,
): Extract<VaultAction, { kind: K }>[] {
	return dispatch.filter(
		(action): action is Extract<VaultAction, { kind: K }> =>
			action.kind === kind,
	);
}

function pageScanPaths(actions: readonly VaultAction[]): VaultScanPath[] {
	return actionsOfKind(actions, VaultActionKind.UpsertMdFile)
		.filter((action) => !action.payload.splitPath.basename.startsWith("__"))
		.map((action) =>
			scroll(
				action.payload.splitPath.pathParts,
				action.payload.splitPath.basename,
				typeof action.payload.content === "string"
					? action.payload.content
					: "",
			),
		);
}

async function processContent(action: VaultAction): Promise<string> {
	if (
		action.kind !== VaultActionKind.ProcessMdFile ||
		!("transform" in action.payload)
	) {
		throw new Error("Expected ProcessMdFile transform");
	}
	return action.payload.transform("");
}

describe("public Scroll split reconciliation", () => {
	it("splits a root Scroll through ordered Tree Actions and bounded projections", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const unrelated = scroll(
			["Library", "Other"],
			"Unrelated-Other",
		);
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename), unrelated],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			),
		);

		expect(result.kind).toBe("Completed");
		if (result.kind !== "Completed") return;
		const pageCount = result.reconciliation.treeActions.requested - 1;
		expect(pageCount).toBeGreaterThan(1);
		expect(result.operationId).toBe("split-1");
		expect(result.reconciliation.operationId).toBe(result.operationId);
		expect(result.initialDispatch.submittedCount).toBe(pageCount + 1);
		expect(result.reconciliation.treeActions).toEqual({
			changed: pageCount + 1,
			failed: 0,
			noOp: 0,
			requested: pageCount + 1,
		});
		expect(result.reconciliation.derived.backlink).toBe(pageCount);
		expect(harness.order).toEqual(["dispatch", "dispatch", "cd"]);
		expect(harness.dispatches).toHaveLength(2);

		const healer = harness.librarian.getHealer();
		expect(healer).not.toBeNull();
		if (!healer) return;
		const shape = toShape(healer);
		expect(shape.children?.Story).toBeDefined();
		expect(shape.children?.Other).toBeDefined();
		const story = shape.children?.Story;
		if (!story || "kind" in story) throw new Error("Expected Story Section");
		const pageNames = Object.keys(story.children ?? {});
		expect(pageNames).toHaveLength(pageCount);
		for (const pageName of pageNames) {
			expect(story.children?.[pageName]).toEqual({
				kind: "Scroll",
				status: TreeNodeStatus.NotStarted,
			});
		}
		expect(harness.librarian.findMatchingLeavesByCoreName("Story")).toEqual(
			[],
		);

		const initial = harness.dispatches[0] ?? [];
		const derived = harness.dispatches[1] ?? [];
		expect(
			initial.map((action) => action.kind),
		).toEqual([
			...Array.from({ length: pageCount }, () =>
				VaultActionKind.UpsertMdFile,
			),
			VaultActionKind.TrashMdFile,
		]);
		const pagePaths = actionsOfKind(
			initial,
			VaultActionKind.UpsertMdFile,
		).map((action) => mdPath(action.payload.splitPath));
		const processedPaths = actionsOfKind(
			derived,
			VaultActionKind.ProcessMdFile,
		).map((action) => mdPath(action.payload.splitPath));
		for (const pagePath of pagePaths) {
			expect(processedPaths).toContain(pagePath);
		}
		expect(processedPaths).not.toContain(
			"Library/Other/Unrelated-Other.md",
		);

		const destinationCodex = actionsOfKind(
			derived,
			VaultActionKind.ProcessMdFile,
		).find((action) => action.payload.splitPath.basename === "__-Story");
		const rootCodex = actionsOfKind(
			derived,
			VaultActionKind.ProcessMdFile,
		).find((action) => action.payload.splitPath.basename === "__-Library");
		expect(destinationCodex).toBeDefined();
		expect(rootCodex).toBeDefined();
		if (!destinationCodex || !rootCodex) return;
		const destinationContent = await processContent(destinationCodex);
		for (const pageName of pageNames) {
			expect(destinationContent).toContain(pageName);
		}
		expect(destinationContent).toContain("__-Library");
		expect(await processContent(rootCodex)).toContain("__-Story");
		expect(harness.navigation).toEqual([result.navigation.path]);
		expect(
			harness.librarian._debugLastReconciliationOutcome?.operationId,
		).toBe(result.operationId);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("splits a nested Scroll and regenerates destination and ancestor Codexes", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story-Parent",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Parent"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			),
		);

		expect(result.kind).toBe("Completed");
		if (result.kind !== "Completed") return;
		const shape = toShape(harness.librarian.getHealer()!);
		const parent = shape.children?.Parent;
		if (!parent || "kind" in parent) throw new Error("Expected Parent Section");
		const story = parent.children?.Story;
		if (!story || "kind" in story) throw new Error("Expected Story Section");
		expect(Object.keys(story.children ?? {}).length).toBeGreaterThan(1);
		const codexPaths = actionsOfKind(
			harness.dispatches[1] ?? [],
			VaultActionKind.ProcessMdFile,
		).map((action) => mdPath(action.payload.splitPath));
		expect(codexPaths).toContain("Library/Parent/Story/__-Story-Parent.md");
		expect(codexPaths).toContain("Library/Parent/__-Parent.md");
		expect(codexPaths).toContain("Library/__-Library.md");

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("does nothing for content below the split threshold", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			content: "Short.",
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;
		const auditCount = harness.librarian.getRecentReconciliationOutcomes().length;

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				{ ...SPLIT_CONFIG, minContentSizeChars: 100 },
			),
		);

		expect(result).toEqual({ kind: "TooShort" });
		expect(harness.dispatches).toEqual([]);
		expect(harness.navigation).toEqual([]);
		expect(harness.order).toEqual([]);
		expect(harness.librarian.getRecentReconciliationOutcomes()).toHaveLength(
			auditCount,
		);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("returns typed planning failure and does not navigate or mutate the Tree", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;
		harness.setDispatch(() =>
			Effect.fail(
				new VamPlanningError({
					cause: new Error("cannot plan split"),
					operation: "planDispatchBatch",
				}),
			),
		);

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				execution: "FailedBeforeExecution",
				kind: "DispatchFailed",
				operationId: "split-1",
				phase: "InitialVaultDispatch",
				recovery: { kind: "NotNeeded" },
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(toShape(harness.librarian.getHealer()!).children?.Story).toEqual({
			kind: "Scroll",
			status: TreeNodeStatus.NotStarted,
		});
		expect(
			harness.librarian._debugLastReconciliationOutcome,
		).toMatchObject({
			operationId: "split-1",
			recovery: { kind: "NotNeeded" },
			status: "Failed",
		});

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("resynchronizes an uncertain page batch before later queued work", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const source = scroll(sourcePath.pathParts, sourcePath.basename);
		const later = scroll(["Library"], "Later");
		const harness = makeHarness({ files: [source], sourcePath });
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("some page writes failed"),
				operation: "executeAction",
			}),
		] as const;
		let releaseDispatch: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			releaseDispatch = resolve;
		});
		let reportStarted: () => void = () => undefined;
		const started = new Promise<void>((resolve) => {
			reportStarted = resolve;
		});
		let fail = true;
		harness.setDispatch(() => {
			if (!fail) return Effect.void;
			fail = false;
			reportStarted();
			return Effect.promise(() => gate).pipe(
				Effect.andThen(Effect.fail(partialFailures)),
			);
		});

		const splitResult = Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);
		await started;
		const laterBulk = Effect.runPromise(
			harness.emitBulk(createdScrollBulk(["Library"], "Later")),
		);
		harness.setScanFiles([source, later]);
		releaseDispatch();
		const [split] = await Promise.all([splitResult, laterBulk]);

		expect(Result.isFailure(split)).toBe(true);
		if (Result.isFailure(split)) {
			expect(split.failure).toMatchObject({
				execution: "ExecutionUncertain",
				kind: "DispatchFailed",
				operationId: "split-1",
				recovery: { kind: "Resynchronized" },
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(harness.dispatches).toHaveLength(2);
		expect(harness.librarian.findMatchingLeavesByCoreName("Story")).toHaveLength(
			1,
		);
		expect(harness.librarian.findMatchingLeavesByCoreName("Later")).toHaveLength(
			1,
		);
		expect(
			harness.librarian.getRecentReconciliationOutcomes().map((outcome) => ({
				operationId: outcome.operationId,
				recovery: outcome.recovery.kind,
				source: outcome.source,
				status: outcome.status,
			})),
		).toEqual([
			{
				operationId: undefined,
				recovery: "NotNeeded",
				source: "Startup",
				status: "Success",
			},
			{
				operationId: "split-1",
				recovery: "Resynchronized",
				source: "CommandIntention",
				status: "PartialFailure",
			},
			{
				operationId: undefined,
				recovery: "NotNeeded",
				source: "ObservedBulk",
				status: "NoOp",
			},
		]);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("finishes semantic reconciliation before honoring command interruption", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;

		await Effect.runPromise(
			Effect.gen(function* () {
				const dispatchStarted = yield* Deferred.make<void>();
				const releaseDispatch = yield* Deferred.make<void>();
				let blockInitialDispatch = true;
				harness.setDispatch(() => {
					if (!blockInitialDispatch) return Effect.void;
					blockInitialDispatch = false;
					return Deferred.succeed(dispatchStarted, undefined).pipe(
						Effect.andThen(Deferred.await(releaseDispatch)),
					);
				});

				const split = yield* splitToPagesAction(
					{ librarian: harness.librarian, vam: harness.vam },
					SPLIT_CONFIG,
				).pipe(Effect.forkChild);
				yield* Deferred.await(dispatchStarted);
				const interruption = yield* Fiber.interrupt(split).pipe(
					Effect.forkChild,
				);
				yield* Effect.yieldNow;

				expect(harness.dispatches).toHaveLength(1);
				yield* Deferred.succeed(releaseDispatch, undefined);
				yield* Fiber.join(interruption);
			}),
		);

		expect(harness.dispatches).toHaveLength(2);
		expect(harness.navigation).toEqual([]);
		expect(
			harness.librarian.getRecentReconciliationOutcomes().at(-1),
		).toMatchObject({
			operationId: "split-1",
			source: "CommandIntention",
			status: "Success",
		});

		await Effect.runPromise(
			harness.emitBulk(createdScrollBulk(["Library"], "Later")),
		);
		expect(
			harness.librarian.findMatchingLeavesByCoreName("Later"),
		).toHaveLength(1);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("treats an unexpected dispatch defect as uncertain and resynchronizes", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		let defect = true;
		harness.setDispatch((actions) => {
			if (!defect) return Effect.void;
			defect = false;
			harness.setScanFiles(pageScanPaths(actions));
			return Effect.die(new Error("unexpected dispatch defect"));
		});

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				execution: "ExecutionUncertain",
				kind: "DispatchFailed",
				operationId: "split-1",
				recovery: { kind: "Resynchronized" },
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(
			harness.librarian._debugLastReconciliationOutcome,
		).toMatchObject({
			dispatch: {
				failure: { _tag: "LibrarianUnexpectedDispatchError" },
				kind: "ExecutionUncertain",
			},
			operationId: "split-1",
			recovery: { kind: "Resynchronized" },
			status: "PartialFailure",
		});
		expect(
			harness.librarian.findMatchingLeavesByCoreName("Story_Page_000"),
		).toHaveLength(1);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("resynchronizes when the derived reconciliation dispatch defects", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		let dispatchIndex = 0;
		harness.setDispatch((actions) => {
			dispatchIndex += 1;
			if (dispatchIndex === 1) {
				harness.setScanFiles(pageScanPaths(actions));
				return Effect.void;
			}
			if (dispatchIndex === 2) {
				return Effect.die(
					new Error("unexpected derived dispatch defect"),
				);
			}
			return Effect.void;
		});

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				kind: "ReconciliationFailed",
				operationId: "split-1",
				phase: "SemanticReconciliation",
				recovery: { kind: "Resynchronized" },
				status: "PartialFailure",
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(harness.dispatches).toHaveLength(3);
		expect(
			harness.librarian.getRecentReconciliationOutcomes().at(-1),
		).toMatchObject({
			dispatch: {
				failure: { _tag: "LibrarianUnexpectedDispatchError" },
				kind: "ExecutionUncertain",
			},
			operationId: "split-1",
			recovery: { kind: "Resynchronized" },
			status: "PartialFailure",
		});
		expect(
			harness.librarian.findMatchingLeavesByCoreName("Story_Page_000"),
		).toHaveLength(1);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("latches unavailable when recovery scanning defects", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("initial execution remained uncertain"),
				operation: "executeAction",
			}),
		] as const;
		harness.setDispatch(() => Effect.fail(partialFailures));
		harness.setScan(() =>
			Effect.die(new Error("unexpected recovery scan defect")),
		);

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				execution: "ExecutionUncertain",
				kind: "DispatchFailed",
				operationId: "split-1",
				recovery: {
					cause: { _tag: "LibrarianUnexpectedRecoveryError" },
					kind: "Failed",
				},
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(harness.dispatches).toHaveLength(1);

		await Effect.runPromise(
			harness.emitBulk(createdScrollBulk(["Library"], "Later")),
		);
		expect(harness.dispatches).toHaveLength(1);
		expect(
			harness.librarian.findMatchingLeavesByCoreName("Later"),
		).toEqual([]);
		expect(
			harness.librarian.getRecentReconciliationOutcomes().at(-1),
		).toMatchObject({
			failure: { kind: "ReconciliationUnavailable" },
			recovery: {
				cause: { _tag: "LibrarianUnexpectedRecoveryError" },
				kind: "Failed",
			},
			source: "ObservedBulk",
			status: "Failed",
		});

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("recovers after reconciliation failure and skips navigation", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;
		let dispatchIndex = 0;
		harness.setDispatch((actions) => {
			dispatchIndex += 1;
			if (dispatchIndex === 1) {
				harness.setScanFiles(pageScanPaths(actions));
				return Effect.void;
			}
			if (dispatchIndex === 2) {
				return Effect.fail(
					new VamPlanningError({
						cause: new Error("derived actions cannot be planned"),
						operation: "planDispatchBatch",
					}),
				);
			}
			return Effect.void;
		});

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			const failure = result.failure as SplitToPagesError;
			expect(failure).toMatchObject({
				kind: "ReconciliationFailed",
				operationId: "split-1",
				phase: "SemanticReconciliation",
				recovery: { kind: "Resynchronized" },
				status: "Failed",
			});
		}
		expect(harness.navigation).toEqual([]);
		expect(harness.dispatches).toHaveLength(3);
		expect(harness.librarian.findMatchingLeavesByCoreName("Story")).toEqual([]);
		expect(
			harness.librarian.findMatchingLeavesByCoreName("Story_Page_000"),
		).toHaveLength(1);

		await Effect.runPromise(harness.librarian.unsubscribe());
	});

	it("returns a typed navigation failure after a reconciled split", async () => {
		const sourcePath: SplitPathToMdFile = {
			basename: "Story",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library"],
		};
		const harness = makeHarness({
			files: [scroll(sourcePath.pathParts, sourcePath.basename)],
			sourcePath,
		});
		await Effect.runPromise(harness.librarian.init());
		harness.dispatches.length = 0;
		harness.order.length = 0;
		harness.setNavigation(() =>
			Effect.fail(
				new VamVaultIoError({
					cause: new Error("cannot open first page"),
					operation: "openFile",
				}),
			),
		);

		const result = await Effect.runPromise(
			splitToPagesAction(
				{ librarian: harness.librarian, vam: harness.vam },
				SPLIT_CONFIG,
			).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				kind: "NavigationFailed",
				operationId: "split-1",
				phase: "Navigation",
			});
		}
		expect(harness.order).toEqual(["dispatch", "dispatch", "cd"]);
		expect(
			harness.librarian._debugLastReconciliationOutcome,
		).toMatchObject({ operationId: "split-1", status: "Success" });

		await Effect.runPromise(harness.librarian.unsubscribe());
	});
});
