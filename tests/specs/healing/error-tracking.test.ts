import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
	type NodeName,
	type SectionNodeSegmentId,
	type TreeAction,
	TreeNodeStatus,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VamDispatchError,
	VamPlanningError,
	type VaultAction,
	VaultActionKind,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Cause, Effect } from "effect";
import {
	classifyVamDispatchFailure,
	LibraryReconciler,
	ReconciliationAuditLog,
	type ReconciliationRecoveryInput,
	type ReconciliationRequest,
} from "../../../src/commanders/librarian/runtime/library-reconciliation";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import {
	makeScrollLocator,
	makeSectionLocator,
	makeTree,
	toShape,
} from "../../unit/librarian/library-tree/tree-test-helpers";

type DispatchFailure =
	| VamPlanningError
	| readonly VamDispatchError[]
	| { readonly cause: unknown; readonly kind: "UnexpectedDispatchFailure" };
type RecoveryFailure =
	| { readonly kind: "RecoveryFailed" }
	| { readonly cause: unknown; readonly kind: "UnexpectedRecoveryFailure" };

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

function createScroll(
	parentNames: string[],
	name: string,
): Extract<TreeAction, { actionType: "Create" }> {
	const suffix = parentNames.slice(1).reverse().join("-");
	return {
		actionType: "Create",
		observedSplitPath: {
			basename: suffix.length > 0 ? `${name}-${suffix}` : name,
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: parentNames,
		},
		targetLocator: makeScrollLocator(
			parentNames as NodeName[],
			name as NodeName,
		),
	};
}

function scanScroll(parentNames: string[], name: string): VaultScanPath {
	const observed = createScroll(parentNames, name).observedSplitPath;
	if (observed.kind !== SplitPathKind.MdFile) {
		throw new Error("Expected Scroll create path");
	}
	return {
		...observed,
		read: () => Effect.succeed(""),
	};
}

function runtimeRequest(
	treeActions: readonly TreeAction[],
	source: "ObservedBulk" | "CodexClick" = "ObservedBulk",
): ReconciliationRequest {
	return {
		source,
		supplemental: { invalidCodexDeletions: [] },
		treeActions,
	};
}

function startupRecovery(
	paths: readonly VaultScanPath[],
): ReconciliationRecoveryInput {
	return {
		healer: makeTree({ libraryRoot: "Library" }),
		request: {
			observedVaultPaths: paths,
			source: "Startup",
			supplemental: { invalidCodexDeletions: [] },
			treeActions: [
				createScroll(["Library"], "Existing"),
				createScroll(["Library"], "New"),
			],
		},
	};
}

function makeHarness(options?: {
	dispatch?: (actions: readonly VaultAction[]) => Effect.Effect<void, DispatchFailure>;
	healer?: ReturnType<typeof makeTree>;
	recover?: () => Effect.Effect<ReconciliationRecoveryInput, RecoveryFailure>;
}) {
	const audit = new ReconciliationAuditLog<DispatchFailure, RecoveryFailure>();
	const dispatches: VaultAction[][] = [];
	const dispatch = options?.dispatch ?? (() => Effect.void);
	const reconciler = new LibraryReconciler(
		options?.healer ?? makeTree({ libraryRoot: "Library" }),
		codecs,
		{
			audit,
			classifyDispatchFailure: (failure) =>
				"kind" in failure &&
				failure.kind === "UnexpectedDispatchFailure"
					? "ExecutionUncertain"
					: classifyVamDispatchFailure(failure),
			dispatch: (actions) =>
				dispatch(actions).pipe(
					Effect.tap(() =>
						Effect.sync(() => dispatches.push([...actions])),
					),
				),
			recover: options?.recover,
			unexpectedDispatchFailure: (cause) => ({
				cause: Cause.squash(cause),
				kind: "UnexpectedDispatchFailure" as const,
			}),
			unexpectedRecoveryFailure: (cause) => ({
				cause: Cause.squash(cause),
				kind: "UnexpectedRecoveryFailure" as const,
			}),
		},
	);
	return { audit, dispatches, reconciler };
}

describe("Library reconciliation interface", () => {
	it("runs startup through one full reconciliation and one dispatch", async () => {
		const { dispatches, reconciler } = makeHarness();
		const path = scanScroll(["Library", "Stories"], "Once");
		const outcome = await Effect.runPromise(
			reconciler.reconcile({
				observedVaultPaths: [path],
				source: "Startup",
				supplemental: { invalidCodexDeletions: [] },
				treeActions: [createScroll(path.pathParts, "Once")],
			}),
		);

		expect(outcome.status).toBe("Success");
		expect(outcome.source).toBe("Startup");
		expect(outcome.treeActions).toEqual({
			changed: 1,
			failed: 0,
			noOp: 0,
			requested: 1,
		});
		expect(outcome.derived.codexRecreation).toBeGreaterThan(0);
		expect(outcome.derived.backlink).toBe(1);
		expect(dispatches).toHaveLength(1);
		expect(
			reconciler
				.getCommittedHealer()
				.findSection(sectionChain("Library", "Stories")),
		).toBeDefined();
	});

	it("uses bounded backlink work for create, delete, rename, move, and status", async () => {
		const cases: Array<{
			action: TreeAction;
			expectedBacklinks: number;
			healer: ReturnType<typeof makeTree>;
			name: string;
		}> = [
			{
				action: createScroll(["Library"], "New"),
				expectedBacklinks: 1,
				healer: makeTree({ libraryRoot: "Library" }),
				name: "create",
			},
			{
				action: {
					actionType: "Delete",
					targetLocator: makeScrollLocator(["Library"], "Story"),
				},
				expectedBacklinks: 0,
				healer: treeWithStory(),
				name: "delete",
			},
			{
				action: {
					actionType: "Rename",
					newNodeName: "Renamed",
					targetLocator: makeScrollLocator(["Library"], "Story"),
				},
				expectedBacklinks: 1,
				healer: treeWithStory(),
				name: "rename",
			},
			{
				action: {
					actionType: "Move",
					newNodeName: "Story",
					newParentLocator: makeSectionLocator(["Library"], "Target"),
					observedSplitPath: {
						basename: "Story-Target",
						extension: MD,
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Target"],
					},
					targetLocator: makeScrollLocator(["Library"], "Story"),
				},
				expectedBacklinks: 1,
				healer: makeTree({
					children: { Story: { kind: "Scroll" }, Target: {} },
					libraryRoot: "Library",
				}),
				name: "move",
			},
			{
				action: {
					actionType: "ChangeStatus",
					newStatus: TreeNodeStatus.Done,
					targetLocator: makeScrollLocator(["Library"], "Story"),
				},
				expectedBacklinks: 0,
				healer: treeWithStory(),
				name: "status",
			},
		];

		for (const testCase of cases) {
			const { dispatches, reconciler } = makeHarness({
				healer: testCase.healer,
			});
			const outcome = await Effect.runPromise(
				reconciler.reconcile(runtimeRequest([testCase.action])),
			);
			expect(outcome.status, testCase.name).toBe("Success");
			expect(outcome.derived.backlink, testCase.name).toBe(
				testCase.expectedBacklinks,
			);

			const shape = toShape(reconciler.getCommittedHealer());
			const processedPaths = dispatchedMdPaths(
				dispatches,
				VaultActionKind.ProcessMdFile,
			);
			switch (testCase.name) {
				case "create":
					expect(shape.children?.New).toEqual({
						kind: "Scroll",
						status: TreeNodeStatus.NotStarted,
					});
					expect(processedPaths).toContain("Library/New.md");
					break;
				case "delete":
					expect(shape.children).toBeUndefined();
					expect(processedPaths).not.toContain("Library/Story.md");
					break;
				case "rename":
					expect(shape.children?.Story).toBeUndefined();
					expect(shape.children?.Renamed).toBeDefined();
					expect(processedPaths).toContain("Library/Renamed.md");
					break;
				case "move":
					expect(shape.children?.Story).toBeUndefined();
					expect(shape.children?.Target).toEqual({
						children: {
							Story: {
								kind: "Scroll",
								status: TreeNodeStatus.NotStarted,
							},
						},
					});
					expect(processedPaths).toContain(
						"Library/Target/Story-Target.md",
					);
					expect(processedPaths).toContain("Library/__-Library.md");
					expect(processedPaths).toContain(
						"Library/Target/__-Target.md",
					);
					break;
				case "status":
					expect(shape.children?.Story).toEqual({
						kind: "Scroll",
						status: TreeNodeStatus.Done,
					});
					expect(processedPaths).toContain("Library/Story.md");
					break;
			}
		}
	});

	it("keeps Codex backlinks inside a status-only Codex projection", async () => {
		const { dispatches, reconciler } = makeHarness({
			healer: makeTree({
				children: {
					Stories: { children: { Once: { kind: "Scroll" } } },
				},
				libraryRoot: "Library",
			}),
		});
		const outcome = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([
					{
						actionType: "ChangeStatus",
						newStatus: TreeNodeStatus.Done,
						targetLocator: makeScrollLocator(
							["Library", "Stories"],
							"Once",
						),
					},
				]),
			),
		);

		expect(outcome.derived.backlink).toBe(0);
		const codexProcess = dispatches[0]?.find(
			(action) =>
				action.kind === VaultActionKind.ProcessMdFile &&
				action.payload.splitPath.basename.startsWith("__") &&
				action.payload.splitPath.pathParts.at(-1) === "Stories",
		);
		expect(codexProcess).toBeDefined();
		if (
			codexProcess?.kind !== VaultActionKind.ProcessMdFile ||
			!("transform" in codexProcess.payload)
		)
			return;
		const content = await codexProcess.payload.transform("stale content");
		expect(content).toContain("[[__");
	});

	it("records no-op and supplemental-only requests through the same audit", async () => {
		const { audit, dispatches, reconciler } = makeHarness({
			healer: treeWithStory(),
		});
		const noOp = await Effect.runPromise(
			reconciler.reconcile(runtimeRequest([createScroll(["Library"], "Story")])),
		);
		const supplemental = await Effect.runPromise(
			reconciler.reconcile({
				source: "ObservedBulk",
				supplemental: {
					invalidCodexDeletions: [
						{
							kind: "DeleteMdFile",
							payload: {
								splitPath: {
									basename: "__-Wrong",
									extension: MD,
									kind: SplitPathKind.MdFile,
									pathParts: ["Library"],
								},
							},
						},
					],
				},
				treeActions: [],
			}),
		);

		expect(noOp.status).toBe("NoOp");
		expect(noOp.dispatch.kind).toBe("NotRequired");
		expect(supplemental.status).toBe("Success");
		expect(supplemental.derived.supplemental).toBe(1);
		expect(dispatches).toHaveLength(1);
		expect(audit.getRecent().map((entry) => entry.status)).toEqual([
			"NoOp",
			"Success",
		]);
	});

	it("discards earlier staged mutations when a later Tree Action fails", async () => {
		const healer = makeTree({
			children: {
				Alpha: { kind: "Scroll" },
				Beta: { kind: "Scroll" },
			},
			libraryRoot: "Library",
		});
		const initialShape = toShape(healer);
		const { audit, dispatches, reconciler } = makeHarness({ healer });
		const outcome = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([
					createScroll(["Library"], "CreatedFirst"),
					{
						actionType: "Rename",
						newNodeName: "Beta",
						targetLocator: makeScrollLocator(["Library"], "Alpha"),
					},
				]),
			),
		);

		expect(outcome.status).toBe("Failed");
		expect(outcome.failure?.kind).toBe("TreeActionFailed");
		expect(outcome.treeActions).toEqual({
			changed: 1,
			failed: 1,
			noOp: 0,
			requested: 2,
		});
		expect(outcome.recovery.kind).toBe("StagedStateDiscarded");
		expect(toShape(reconciler.getCommittedHealer())).toEqual(initialShape);
		expect(dispatches).toEqual([]);
		expect(audit.getRecent()).toEqual([outcome]);
	});

	it("records typed planning failure and leaves committed state reusable", async () => {
		const planningFailure = new VamPlanningError({
			action: undefined,
			cause: new Error("cannot plan"),
			operation: "planDispatchBatch",
		});
		let fail = true;
		const { reconciler } = makeHarness({
			dispatch: () =>
				fail ? Effect.fail(planningFailure) : Effect.void,
		});
		const action = createScroll(["Library"], "Story");
		const failed = await Effect.runPromise(
			reconciler.reconcile(runtimeRequest([action])),
		);

		expect(failed.status).toBe("Failed");
		expect(failed.dispatch).toEqual({
			failure: planningFailure,
			kind: "FailedBeforeExecution",
			submittedCount: failed.derived.vault,
		});
		expect(toShape(reconciler.getCommittedHealer()).children).toBeUndefined();

		fail = false;
		const retried = await Effect.runPromise(
			reconciler.reconcile(runtimeRequest([action])),
		);
		expect(retried.status).toBe("Success");
	});

	it("records self-event registration failure before action execution", async () => {
		const registrationFailure = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("registration failed"),
				operation: "registerSelfEvents",
			}),
		] as const;
		const { reconciler } = makeHarness({
			dispatch: () => Effect.fail(registrationFailure),
		});

		const outcome = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([createScroll(["Library"], "Story")]),
			),
		);

		expect(outcome.status).toBe("Failed");
		expect(outcome.dispatch.kind).toBe("FailedBeforeExecution");
		expect(outcome.recovery.kind).toBe("StagedStateDiscarded");
		expect(toShape(reconciler.getCommittedHealer()).children).toBeUndefined();
	});

	it("audits preceding split planning and registration failures without recovery", async () => {
		const failures: DispatchFailure[] = [
			new VamPlanningError({
				action: undefined,
				cause: new Error("planning failed"),
				operation: "planDispatchBatch",
			}),
			[
				new VamDispatchError({
					action: undefined,
					cause: new Error("registration failed"),
					operation: "registerSelfEvents",
				}),
			],
		];

		for (const [index, failure] of failures.entries()) {
			let recoveries = 0;
			const { audit, reconciler } = makeHarness({
				recover: () => {
					recoveries += 1;
					return Effect.succeed(startupRecovery([]));
				},
			});
			const outcome = await Effect.runPromise(
				reconciler.reconcileExternalDispatchFailure({
					failure,
					operationId: `split-${index + 1}`,
					source: "CommandIntention",
					submittedCount: 3,
				}),
			);

			expect(outcome.status).toBe("Failed");
			expect(outcome.dispatch.kind).toBe("FailedBeforeExecution");
			expect(outcome.recovery.kind).toBe("NotNeeded");
			expect(outcome.operationId).toBe(`split-${index + 1}`);
			expect(outcome.source).toBe("CommandIntention");
			expect(recoveries).toBe(0);
			expect(audit.getRecent()).toEqual([outcome]);
		}
	});

	it("resynchronizes an uncertain split file batch before accepting later work", async () => {
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("page write failed"),
				operation: "executeAction",
			}),
		] as const;
		const recoveryPaths = [
			scanScroll(["Library"], "Existing"),
			scanScroll(["Library"], "New"),
		];
		const { audit, reconciler } = makeHarness({
			healer: makeTree({
				children: { Existing: { kind: "Scroll" } },
				libraryRoot: "Library",
			}),
			recover: () => Effect.succeed(startupRecovery(recoveryPaths)),
		});

		const outcome = await Effect.runPromise(
			reconciler.reconcileExternalDispatchFailure({
				failure: partialFailures,
				operationId: "split-42",
				source: "CommandIntention",
				submittedCount: 3,
			}),
		);

		expect(outcome.status).toBe("PartialFailure");
		expect(outcome.dispatch.kind).toBe("ExecutionUncertain");
		expect(outcome.recovery.kind).toBe("Resynchronized");
		expect(outcome.operationId).toBe("split-42");
		expect(outcome.treeActions.requested).toBe(0);
		expect(
			Object.keys(toShape(reconciler.getCommittedHealer()).children ?? {}),
		).toEqual(["Existing", "New"]);
		expect(audit.getRecent()).toEqual([outcome]);
	});

	it("latches unavailable when uncertain split-batch recovery also fails", async () => {
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("execution remained uncertain"),
				operation: "executeAction",
			}),
		] as const;
		let recoveryDispatches = 0;
		const recoveryPaths = [
			scanScroll(["Library"], "Existing"),
			scanScroll(["Library"], "New"),
		];
		const { reconciler } = makeHarness({
			dispatch: () => {
				recoveryDispatches += 1;
				return Effect.fail(partialFailures);
			},
			recover: () => Effect.succeed(startupRecovery(recoveryPaths)),
		});

		const external = await Effect.runPromise(
			reconciler.reconcileExternalDispatchFailure({
				failure: partialFailures,
				operationId: "split-99",
				source: "CommandIntention",
				submittedCount: 3,
			}),
		);
		const later = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([createScroll(["Library"], "Later")]),
			),
		);

		expect(external.status).toBe("PartialFailure");
		expect(external.recovery.kind).toBe("Failed");
		expect(external.operationId).toBe("split-99");
		expect(later.status).toBe("Failed");
		expect(later.failure?.kind).toBe("ReconciliationUnavailable");
		expect(recoveryDispatches).toBe(1);
	});

	it("records partial execution and resynchronizes before later work", async () => {
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("write failed"),
				operation: "executeAction",
			}),
		] as const;
		let dispatchCount = 0;
		const recoveryPaths = [
			scanScroll(["Library"], "Existing"),
			scanScroll(["Library"], "New"),
		];
		const { audit, reconciler } = makeHarness({
			dispatch: () => {
				dispatchCount += 1;
				return dispatchCount === 1
					? Effect.fail(partialFailures)
					: Effect.void;
			},
			healer: makeTree({
				children: { Existing: { kind: "Scroll" } },
				libraryRoot: "Library",
			}),
			recover: () => Effect.succeed(startupRecovery(recoveryPaths)),
		});
		const partial = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([createScroll(["Library"], "New")]),
			),
		);

		expect(partial.status).toBe("PartialFailure");
		expect(partial.dispatch.kind).toBe("ExecutionUncertain");
		if (partial.dispatch.kind === "ExecutionUncertain") {
			expect(partial.dispatch.failure).toBe(partialFailures);
		}
		expect(partial.recovery.kind).toBe("Resynchronized");
		expect(dispatchCount).toBe(2);
		expect(Object.keys(toShape(reconciler.getCommittedHealer()).children ?? {})).toEqual([
			"Existing",
			"New",
		]);

		const later = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([
					{
						actionType: "ChangeStatus",
						newStatus: TreeNodeStatus.Done,
						targetLocator: makeScrollLocator(["Library"], "Existing"),
					},
				]),
			),
		);
		expect(later.status).toBe("Success");
		expect(dispatchCount).toBe(3);
		expect(audit.getRecent().map((entry) => entry.status)).toEqual([
			"PartialFailure",
			"Success",
		]);
	});

	it("latches unavailable after unrecovered partial execution", async () => {
		const partialFailures = [
			new VamDispatchError({
				action: undefined,
				cause: new Error("partial"),
				operation: "executeAction",
			}),
		] as const;
		let dispatches = 0;
		const { reconciler } = makeHarness({
			dispatch: () => {
				dispatches += 1;
				return Effect.fail(partialFailures);
			},
		});
		const partial = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([createScroll(["Library"], "First")]),
			),
		);
		const blocked = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([createScroll(["Library"], "Second")]),
			),
		);

		expect(partial.status).toBe("PartialFailure");
		expect(partial.recovery.kind).toBe("Failed");
		expect(blocked.status).toBe("Failed");
		expect(blocked.failure?.kind).toBe("ReconciliationUnavailable");
		expect(dispatches).toBe(1);
	});

	it("bounds a nested Section move and replaces moved Codex projections", async () => {
		const { dispatches, reconciler } = makeHarness({
			healer: makeTree({
				children: {
					A: {
						children: {
							Moved: {
								children: {
									Deep: { children: { Two: { kind: "Scroll" } } },
									One: { kind: "Scroll" },
								},
							},
							Sibling: { kind: "Scroll" },
						},
					},
					B: {},
					Unrelated: { children: { Outside: { kind: "Scroll" } } },
				},
				libraryRoot: "Library",
			}),
		});
		const outcome = await Effect.runPromise(
			reconciler.reconcile(
				runtimeRequest([
					{
						actionType: "Move",
						newNodeName: "Moved",
						newParentLocator: makeSectionLocator(["Library"], "B"),
						observedSplitPath: {
							basename: "Moved",
							kind: SplitPathKind.Folder,
							pathParts: ["Library", "B"],
						},
						targetLocator: makeSectionLocator(
							["Library", "A"],
							"Moved",
						),
					},
				]),
			),
		);

		expect(outcome.status).toBe("Success");
		expect(outcome.derived.backlink).toBe(2);
		expect(toShape(reconciler.getCommittedHealer())).toEqual({
			children: {
				A: {
					children: {
						Sibling: {
							kind: "Scroll",
							status: TreeNodeStatus.NotStarted,
						},
					},
				},
				B: {
					children: {
						Moved: {
							children: {
								Deep: {
									children: {
										Two: {
											kind: "Scroll",
											status: TreeNodeStatus.NotStarted,
										},
									},
								},
								One: {
									kind: "Scroll",
									status: TreeNodeStatus.NotStarted,
								},
							},
						},
					},
				},
				Unrelated: {
					children: {
						Outside: {
							kind: "Scroll",
							status: TreeNodeStatus.NotStarted,
						},
					},
				},
			},
			libraryRoot: "Library",
		});
		expect(
			dispatchedMdPaths(dispatches, VaultActionKind.TrashMdFile),
		).toEqual([
			"Library/B/Moved/__-Moved-A.md",
			"Library/B/Moved/Deep/__-Deep-Moved-A.md",
		]);
		const processedPaths = dispatchedMdPaths(
			dispatches,
			VaultActionKind.ProcessMdFile,
		);
		expect(processedPaths).toContain(
			"Library/B/Moved/One-Moved-B.md",
		);
		expect(processedPaths).toContain(
			"Library/B/Moved/Deep/Two-Deep-Moved-B.md",
		);
		expect(processedPaths).toContain(
			"Library/B/Moved/__-Moved-B.md",
		);
		expect(processedPaths).toContain(
			"Library/B/Moved/Deep/__-Deep-Moved-B.md",
		);
		expect(outcome.id).toBe("reconcile-1");
		for (const duration of Object.values(outcome.stages)) {
			expect(duration).toBeGreaterThanOrEqual(0);
		}
	});
});

function treeWithStory() {
	return makeTree({
		children: { Story: { kind: "Scroll" } },
		libraryRoot: "Library",
	});
}

function sectionChain(...names: string[]): SectionNodeSegmentId[] {
	return names.map(
		(name) => `${name}﹘Section﹘` as SectionNodeSegmentId,
	);
}

function dispatchedMdPaths(
	dispatches: readonly (readonly VaultAction[])[],
	kind:
		| typeof VaultActionKind.ProcessMdFile
		| typeof VaultActionKind.TrashMdFile,
): string[] {
	return dispatches.flatMap((dispatch) =>
		dispatch.flatMap((action) => {
			if (action.kind !== kind) return [];
			const { basename, extension, pathParts } = action.payload.splitPath;
			return [`${[...pathParts, basename].join("/")}.${extension}`];
		}),
	);
}
