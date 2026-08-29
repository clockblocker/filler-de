import { describe, expect, it } from "bun:test";
import {
	type SplitPathToMdFile,
	VamPlanningError,
	VaultActionKind,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Result } from "effect";
import { goToNextPageCommand } from "../../../src/commanders/librarian/commands/navigate-pages";
import { splitInBlocksCommand } from "../../../src/commanders/librarian/commands/split-in-blocks";
import { splitToPagesCommand } from "../../../src/commanders/librarian/commands/split-to-pages";
import type { LibrarianCommandInput } from "../../../src/commanders/librarian/commands/types";
import type {
	Librarian,
	LibrarianReconciliationOutcome,
} from "../../../src/commanders/librarian/librarian";
import type { PageSplitPlan } from "../../../src/commanders/librarian/pages/build-actions";
import { getAdjacentPageInfo } from "../../../src/commanders/librarian/pages/page-codec";
import { splitToPagesAction } from "../../../src/commanders/librarian/pages/split-to-pages-action";
import { setupGetParsedUserSettingsSpyWithHooks } from "../common-utils/setup-spy";

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

const NEXT_PATH: SplitPathToMdFile = {
	...SOURCE_PATH,
	basename: "Next",
};

setupGetParsedUserSettingsSpyWithHooks();

function makeInput(options: {
	librarian?: Partial<Librarian>;
	notify?: (message: string) => void;
	selectionText?: string | null;
	vam: Partial<VaultActionManager>;
}): LibrarianCommandInput {
	return {
		commandContext: {
			activeFile: { content: "existing ^4", splitPath: SOURCE_PATH },
			selection: {
				selectionStartInBlock: 0,
				splitPathToFileWithSelection: SOURCE_PATH,
				surroundingRawBlock: options.selectionText ?? "",
				text: options.selectionText ?? null,
			},
		},
		librarianState: {
			librarian: options.librarian as Librarian,
			notify: options.notify ?? (() => {}),
			vam: options.vam as VaultActionManager,
		},
	};
}

describe("Librarian Effect commands", () => {
	it("reports a missing selection through the Effect error channel", async () => {
		const notifications: string[] = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: null,
			vam: {},
		});

		const result = await Effect.runPromise(
			splitInBlocksCommand(input).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.kind).toBe("NoSelection");
		}
		expect(notifications).toEqual(["No text selected"]);
	});

	it("composes page navigation with the Effect VAM facade", async () => {
		const opened: SplitPathToMdFile[] = [];
		const input = makeInput({
			librarian: { getNextPage: () => NEXT_PATH },
			vam: {
				cd: (path) =>
					Effect.sync(() => {
						opened.push(path);
					}),
			},
		});

		await Effect.runPromise(goToNextPageCommand(input));

		expect(opened).toEqual([NEXT_PATH]);
	});

	it("dispatches block splitting and notifies from inside the Effect", async () => {
		const notifications: string[] = [];
		const dispatches: Array<readonly { kind: string }[]> = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: "First sentence. Second sentence.",
			vam: {
				dispatch: (actions) =>
					Effect.sync(() => {
						dispatches.push(actions);
					}),
			},
		});

		await Effect.runPromise(splitInBlocksCommand(input));

		expect(dispatches).toHaveLength(1);
		expect(dispatches[0]?.[0]?.kind).toBe(VaultActionKind.ProcessMdFile);
		expect(notifications).toEqual(["Split into 1 blocks"]);
	});

	it("maps Effect VAM dispatch failures into CommandError", async () => {
		const notifications: string[] = [];
		const input = makeInput({
			notify: (message) => notifications.push(message),
			selectionText: "Selected sentence.",
			vam: {
				dispatch: () =>
					Effect.fail(
						new VamPlanningError({
							cause: new Error("planning failed"),
							operation: "planDispatchBatch",
						}),
					),
			},
		});

		const result = await Effect.runPromise(
			splitInBlocksCommand(input).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure.kind).toBe("DispatchFailed");
			if (result.failure.kind === "DispatchFailed") {
				expect(result.failure.reason).toContain("planning failed");
			}
		}
		expect(notifications[0]).toContain("planning failed");
	});

	it("preserves split operation and recovery details at the command boundary", async () => {
		const opened: SplitPathToMdFile[] = [];
		const failure = new VamPlanningError({
			cause: new Error("split planning failed"),
			operation: "planDispatchBatch",
		});
		const dispatch = {
			failure,
			kind: "FailedBeforeExecution" as const,
			submittedCount: 3,
		};
		const outcome: LibrarianReconciliationOutcome = {
			derived: {
				backlink: 0,
				codexDeletion: 0,
				codexRecreation: 0,
				healing: 0,
				statusProjection: 0,
				supplemental: 0,
				vault: 0,
			},
			dispatch,
			durationMs: 1,
			failure: { dispatch, kind: "DispatchFailed" },
			id: "reconcile-1",
			operationId: "split-1",
			recovery: { kind: "NotNeeded" },
			source: "CommandIntention",
			stages: { applyMs: 0, deriveMs: 0, dispatchMs: 0, recoveryMs: 0 },
			startedAt: 1,
			status: "Failed",
			treeActions: { changed: 0, failed: 0, noOp: 0, requested: 0 },
		};
		const librarian = {
			executeSplitIntention: () =>
				Effect.succeed({
					failure,
					kind: "VaultDispatchFailed" as const,
					operationId: "split-1",
					outcome,
				}),
		} as unknown as Librarian;
		const content = Array.from(
			{ length: 80 },
			(_, index) => `Paragraph ${index}. This sentence has enough text to split.`,
		).join("\n\n");
		const input = makeInput({
			librarian,
			vam: {
				cd: (path) =>
					Effect.sync(() => {
						opened.push(path);
					}),
				getActiveEditorContext: () =>
					Effect.succeed(makeActiveContext(content)),
			},
		});

		const result = await Effect.runPromise(
			splitToPagesCommand(input).pipe(Effect.result),
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
		expect(opened).toEqual([]);
	});

	it("preserves reconciliation identity and status at the command boundary", async () => {
		const failure = new VamPlanningError({
			cause: new Error("derived planning failed"),
			operation: "planDispatchBatch",
		});
		const dispatch = {
			failure,
			kind: "FailedBeforeExecution" as const,
			submittedCount: 4,
		};
		const outcome: LibrarianReconciliationOutcome = {
			derived: {
				backlink: 2,
				codexDeletion: 0,
				codexRecreation: 2,
				healing: 0,
				statusProjection: 0,
				supplemental: 0,
				vault: 4,
			},
			dispatch,
			durationMs: 1,
			failure: { dispatch, kind: "DispatchFailed" },
			id: "reconcile-2",
			operationId: "split-1",
			recovery: { kind: "Resynchronized" },
			source: "CommandIntention",
			stages: { applyMs: 0, deriveMs: 0, dispatchMs: 1, recoveryMs: 0 },
			startedAt: 1,
			status: "Failed",
			treeActions: { changed: 3, failed: 0, noOp: 0, requested: 3 },
		};
		const librarian = {
			executeSplitIntention: () =>
				Effect.succeed({
					initialDispatch: { kind: "Completed" as const, submittedCount: 3 },
					kind: "ReconciliationFailed" as const,
					operationId: "split-1",
					outcome,
				}),
		} as unknown as Librarian;
		const content = Array.from(
			{ length: 80 },
			(_, index) => `Paragraph ${index}. This sentence has enough text to split.`,
		).join("\n\n");
		const input = makeInput({
			librarian,
			vam: {
				cd: () => Effect.die("navigation must be skipped"),
				getActiveEditorContext: () =>
					Effect.succeed(makeActiveContext(content)),
			},
		});

		const result = await Effect.runPromise(
			splitToPagesCommand(input).pipe(Effect.result),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				kind: "DispatchFailed",
				operationId: "split-1",
				phase: "SemanticReconciliation",
				reconciliationId: "reconcile-2",
				recovery: { kind: "Resynchronized" },
				status: "Failed",
			});
		}
	});
});

describe("getAdjacentPageInfo", () => {
	it("lists adjacent pages through the Effect facade", async () => {
		const currentPage = {
			...SOURCE_PATH,
			basename: "Story_Page_001-Story",
			pathParts: ["Library", "Story"],
		};
		const vam = {
			list: () =>
				Effect.succeed([
					{ ...currentPage, basename: "Story_Page_000-Story" },
					{ ...currentPage, basename: "Story_Page_002-Story" },
				]),
		} as unknown as VaultActionManager;

		const result = await Effect.runPromise(
			getAdjacentPageInfo(vam, currentPage),
		);

		expect(result).toEqual({ hasNextPage: true, hasPrevPage: true });
	});
});

describe("splitToPagesAction", () => {
	it("sequences reads, queued Library intention, and navigation in one Effect", async () => {
		const order: string[] = [];
		const intentions: PageSplitPlan[] = [];
		const vam = {
			cd: () => Effect.sync(() => order.push("cd")),
			getActiveEditorContext: () =>
				Effect.sync(() => {
					order.push("context");
					return makeActiveContext(
						"First sentence.\n\nSecond sentence.",
					);
				}),
		} as unknown as VaultActionManager;
		const outcome: LibrarianReconciliationOutcome = {
			derived: {
				backlink: 2,
				codexDeletion: 0,
				codexRecreation: 4,
				healing: 0,
				statusProjection: 0,
				supplemental: 0,
				vault: 6,
			},
			dispatch: { kind: "Completed", submittedCount: 6 },
			durationMs: 1,
			id: "reconcile-2",
			operationId: "split-1",
			recovery: { kind: "NotNeeded" },
			source: "CommandIntention",
			stages: { applyMs: 0, deriveMs: 0, dispatchMs: 1, recoveryMs: 0 },
			startedAt: 1,
			status: "Success",
			treeActions: { changed: 3, failed: 0, noOp: 0, requested: 3 },
		};
		const librarian = {
			executeSplitIntention: (intention: PageSplitPlan) =>
				Effect.sync(() => {
					order.push("intention");
					intentions.push(intention);
					return {
						initialDispatch: {
							kind: "Completed" as const,
							submittedCount: intention.vaultActions.length,
						},
						kind: "Completed" as const,
						operationId: "split-1",
						outcome,
					};
				}),
		} as unknown as Librarian;

		const result = await Effect.runPromise(
			splitToPagesAction(
				{
					librarian,
					vam,
				},
				{
					maxPageSizeChars: 30,
					minContentSizeChars: 1,
					preserveDialogues: true,
					preserveParagraphs: true,
					targetPageSizeChars: 20,
				},
			),
		);

		expect(order).toEqual(["context", "intention", "cd"]);
		expect(intentions).toHaveLength(1);
		expect(
			intentions[0]?.treeActions.map((action) => action.actionType),
		).toEqual(["Delete", "Create"]);
		expect(result).toMatchObject({
			kind: "Completed",
			operationId: "split-1",
			reconciliation: { id: "reconcile-2" },
		});
	});
});

function makeActiveContext(content: string) {
	return {
		content,
		currentLine: content.split("\n")[0] ?? "",
		cursor: { ch: 0, line: 0 },
		selection: {
			selectionStartInBlock: null,
			splitPathToFileWithSelection: SOURCE_PATH,
			surroundingRawBlock: content.split("\n")[0] ?? "",
			text: null,
		},
		splitPath: SOURCE_PATH,
	};
}
