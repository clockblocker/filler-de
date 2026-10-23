import {
	type Codecs,
	type CodexAction,
	codexActionsToVaultActions,
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	codexImpactToRecreations,
	extractScrollStatusActions,
	findInvalidCodexFiles,
	getBacklinkHealingVaultActions,
	getIncrementalBacklinkHealingVaultActions,
	type Healer,
	type HealerApplyResult,
	type HealingAction,
	healingActionsToVaultActions,
	type LibraryIssue,
	mergeCodexImpacts,
	type SplitPathToMdFileInsideLibrary,
	scanAndGenerateOrphanActions,
	type TreeAction,
} from "@textfresser/library-core";
import {
	SplitPathKind,
	type VamDispatchFailure,
	type VaultAction,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { type Cause, Clock, Effect, Ref, Result } from "effect";
import { logLibraryIssues } from "./log-library-issues";

type ReconciliationSource =
	| "Startup"
	| "ObservedBulk"
	| "CodexClick"
	| "CommandIntention";

type ReconciliationSupplementalObservations = {
	readonly invalidCodexDeletions: readonly HealingAction[];
};

type RuntimeReconciliationRequest = {
	readonly operationId?: string;
	readonly source: Exclude<ReconciliationSource, "Startup">;
	readonly supplemental: ReconciliationSupplementalObservations;
	readonly treeActions: readonly TreeAction[];
};

type StartupReconciliationRequest = {
	readonly observedVaultPaths: readonly VaultScanPath[];
	readonly operationId?: string;
	readonly source: "Startup";
	readonly supplemental: ReconciliationSupplementalObservations;
	readonly treeActions: readonly TreeAction[];
};

export type ReconciliationRequest =
	| RuntimeReconciliationRequest
	| StartupReconciliationRequest;

/** Classify a VAM dispatch failure by whether it may have changed the vault. */
export function classifyVamDispatchFailure(
	failure: VamDispatchFailure,
): "FailedBeforeExecution" | "ExecutionUncertain" {
	return failure.report.touchedVault === "no"
		? "FailedBeforeExecution"
		: "ExecutionUncertain";
}

export type ReconciliationTreeActionCounts = {
	readonly changed: number;
	readonly failed: number;
	readonly noOp: number;
	readonly requested: number;
};

export type ReconciliationDerivedCounts = {
	readonly backlink: number;
	readonly codexDeletion: number;
	readonly codexRecreation: number;
	readonly healing: number;
	readonly statusProjection: number;
	readonly supplemental: number;
	readonly vault: number;
};

type ReconciliationStageDurations = {
	readonly applyMs: number;
	readonly deriveMs: number;
	readonly dispatchMs: number;
	readonly recoveryMs: number;
};

type ReconciliationDispatchRecord<E> =
	| { readonly kind: "NotRequired" }
	| { readonly kind: "Completed"; readonly submittedCount: number }
	| {
			readonly failure: E;
			readonly kind: "FailedBeforeExecution" | "ExecutionUncertain";
			readonly submittedCount: number;
	  };

type ReconciliationRecoveryRecord<R> =
	| { readonly kind: "NotNeeded" }
	| { readonly kind: "StagedStateDiscarded" }
	| { readonly kind: "Resynchronized" }
	| { readonly cause: R | unknown; readonly kind: "Failed" };

type ReconciliationFailure<E> =
	| {
			readonly action: TreeAction;
			readonly actionIndex: number;
			readonly cause: unknown;
			readonly kind: "TreeActionFailed";
	  }
	| { readonly cause: unknown; readonly kind: "DerivationFailed" }
	| {
			readonly dispatch: ReconciliationDispatchRecord<E>;
			readonly kind: "DispatchFailed";
	  }
	| { readonly cause: unknown; readonly kind: "ReconciliationUnavailable" };

type ReconciliationStatus = "Success" | "NoOp" | "Failed" | "PartialFailure";

export type ReconciliationOutcome<E, R = unknown> = {
	readonly derived: ReconciliationDerivedCounts;
	readonly dispatch: ReconciliationDispatchRecord<E>;
	readonly durationMs: number;
	readonly failure?: ReconciliationFailure<E>;
	readonly id: string;
	readonly operationId?: string;
	readonly recovery: ReconciliationRecoveryRecord<R>;
	readonly source: ReconciliationSource;
	readonly stages: ReconciliationStageDurations;
	readonly startedAt: number;
	readonly status: ReconciliationStatus;
	readonly treeActions: ReconciliationTreeActionCounts;
};

export type ReconciliationRecoveryInput = {
	readonly healer: Healer;
	readonly request: StartupReconciliationRequest;
};

type LibraryReconcilerOptions<E, R> = {
	readonly classifyDispatchFailure: (
		failure: E,
	) => "FailedBeforeExecution" | "ExecutionUncertain";
	readonly dispatch: (
		actions: readonly VaultAction[],
	) => Effect.Effect<void, E>;
	readonly recover?: () => Effect.Effect<ReconciliationRecoveryInput, R>;
	readonly unexpectedDispatchFailure: (cause: Cause.Cause<never>) => E;
	readonly unexpectedRecoveryFailure: (cause: Cause.Cause<never>) => R;
	readonly audit?: ReconciliationAuditLog<E, R>;
};

type DerivedActions = {
	readonly backlinks: readonly VaultAction[];
	readonly codexDeletions: readonly HealingAction[];
	readonly codexRecreations: readonly CodexAction[];
	readonly healing: readonly HealingAction[];
	readonly statusProjections: readonly CodexAction[];
	readonly supplemental: readonly HealingAction[];
	readonly vault: readonly VaultAction[];
};

type AttemptResult<E, R> = {
	readonly candidate?: Healer;
	readonly outcome: ReconciliationOutcome<E, R>;
};

export type ExternalDispatchFailureInput<E> = {
	readonly failure: E;
	readonly operationId: string;
	readonly source: Exclude<ReconciliationSource, "Startup">;
	readonly submittedCount: number;
};

const ZERO_DERIVED_COUNTS: ReconciliationDerivedCounts = {
	backlink: 0,
	codexDeletion: 0,
	codexRecreation: 0,
	healing: 0,
	statusProjection: 0,
	supplemental: 0,
	vault: 0,
};

const ZERO_STAGE_DURATIONS: ReconciliationStageDurations = {
	applyMs: 0,
	deriveMs: 0,
	dispatchMs: 0,
	recoveryMs: 0,
};

/** The audit log's entries, oldest first, and the last id it gave. */
type AuditEntries<E, R> = {
	readonly entries: readonly ReconciliationOutcome<E, R>[];
	readonly lastId: number;
};

/** The latest reconciliation outcomes, at most `maxEntries` of them. */
export class ReconciliationAuditLog<E, R = unknown> {
	private readonly state = Ref.makeUnsafe<AuditEntries<E, R>>({
		entries: [],
		lastId: 0,
	});

	constructor(private readonly maxEntries = 1_000) {}

	readonly allocateId: Effect.Effect<string> = Ref.modify(
		this.state,
		(state): [string, AuditEntries<E, R>] => [
			`reconcile-${state.lastId + 1}`,
			{ ...state, lastId: state.lastId + 1 },
		],
	);

	record(outcome: ReconciliationOutcome<E, R>): Effect.Effect<void> {
		return Ref.update(this.state, (state) => ({
			...state,
			entries: [...state.entries, outcome].slice(-this.maxEntries),
		}));
	}

	/** The latest `count` outcomes, oldest first, as they are now. */
	getRecent(count = 10): readonly ReconciliationOutcome<E, R>[] {
		return Ref.getUnsafe(this.state).entries.slice(-count);
	}
}

/**
 * What a reconciler holds: the committed Tree, and, once a failure was not
 * recovered, its cause, which stops every later reconciliation.
 */
type ReconcilerState = {
	readonly healer: Healer;
	readonly unavailable: { readonly cause: unknown } | null;
};

/**
 * Owns the complete Tree Action -> VAM reconciliation boundary.
 *
 * Each request is applied to a fork of the last acknowledged Tree. The fork is
 * published only after dispatch completes. Failures are total, audited
 * outcomes; execution-uncertain dispatch failures, at startup too, require a
 * vault-backed recovery before the reconciler accepts later work.
 */
export class LibraryReconciler<E, R = unknown> {
	/** The committed Tree, and what stops every later reconciliation. */
	private readonly state: Ref.Ref<ReconcilerState>;

	constructor(
		healer: Healer,
		private readonly codecs: Codecs,
		private readonly options: LibraryReconcilerOptions<E, R>,
	) {
		this.state = Ref.makeUnsafe<ReconcilerState>({
			healer,
			unavailable: null,
		});
	}

	/** The Tree of the last reconciliation that was acknowledged, as it is now. */
	getCommittedHealer(): Healer {
		return Ref.getUnsafe(this.state).healer;
	}

	/** Whether an unrecovered failure stops every later reconciliation. */
	isUnavailable(): boolean {
		return Ref.getUnsafe(this.state).unavailable !== null;
	}

	getAuditLog(): ReconciliationAuditLog<E, R> {
		return this.options.audit ?? this.fallbackAudit;
	}

	private readonly fallbackAudit = new ReconciliationAuditLog<E, R>();

	/** Publishes `healer` as the committed Tree; the reconciler is available again. */
	private commit(healer: Healer): Effect.Effect<void> {
		return Ref.set(this.state, { healer, unavailable: null });
	}

	/** Stops every later reconciliation, for `cause`, until a recovery succeeds. */
	private markUnavailable(cause: unknown): Effect.Effect<void> {
		return Ref.update(this.state, (state) => ({
			...state,
			unavailable: { cause },
		}));
	}

	readonly reconcile = Effect.fn("LibraryReconciler.reconcile")(function* (
		this: LibraryReconciler<E, R>,
		request: ReconciliationRequest,
	): Effect.fn.Return<ReconciliationOutcome<E, R>> {
		const audit = this.getAuditLog();
		const id = yield* audit.allocateId;
		const startedAt = yield* Clock.currentTimeMillis;
		const { healer, unavailable } = yield* Ref.get(this.state);

		if (unavailable !== null) {
			const endedAt = yield* Clock.currentTimeMillis;
			const outcome: ReconciliationOutcome<E, R> = {
				derived: ZERO_DERIVED_COUNTS,
				dispatch: { kind: "NotRequired" },
				durationMs: endedAt - startedAt,
				failure: {
					cause: unavailable.cause,
					kind: "ReconciliationUnavailable",
				},
				id,
				operationId: request.operationId,
				recovery: { cause: unavailable.cause, kind: "Failed" },
				source: request.source,
				stages: ZERO_STAGE_DURATIONS,
				startedAt,
				status: "Failed",
				treeActions: {
					changed: 0,
					failed: 0,
					noOp: 0,
					requested: request.treeActions.length,
				},
			};
			yield* audit.record(outcome);
			return outcome;
		}

		const attempt = yield* this.attempt(id, startedAt, healer, request);
		let outcome = attempt.outcome;

		if (attempt.candidate) {
			yield* this.commit(attempt.candidate);
			yield* audit.record(outcome);
			return outcome;
		}

		// A runtime failure, or a startup batch that partly ran, leaves the
		// vault somewhere between the committed Tree and the staged one. A
		// rescan rebuilds the Tree from the vault and heals what is left, once.
		// Only when that also fails does the reconciler become unavailable.
		if (
			this.options.recover &&
			(request.source !== "Startup" ||
				outcome.dispatch.kind === "ExecutionUncertain")
		) {
			outcome = yield* this.resynchronize(outcome);
		} else if (outcome.dispatch.kind === "ExecutionUncertain") {
			yield* this.markUnavailable(outcome.failure);
			outcome = {
				...outcome,
				recovery: { cause: outcome.failure, kind: "Failed" },
			};
		} else {
			outcome = {
				...outcome,
				recovery: { kind: "StagedStateDiscarded" },
			};
		}

		yield* audit.record(outcome);
		return outcome;
	});

	/**
	 * Audit and recover an execution-uncertain VAM batch that preceded semantic
	 * Tree reconciliation, such as the page-file phase of a split command.
	 */
	readonly reconcileExternalDispatchFailure = Effect.fn(
		"LibraryReconciler.reconcileExternalDispatchFailure",
	)(function* (
		this: LibraryReconciler<E, R>,
		input: ExternalDispatchFailureInput<E>,
	): Effect.fn.Return<ReconciliationOutcome<E, R>> {
		const audit = this.getAuditLog();
		const id = yield* audit.allocateId;
		const startedAt = yield* Clock.currentTimeMillis;
		const dispatchKind = this.options.classifyDispatchFailure(
			input.failure,
		);
		const dispatch: ReconciliationDispatchRecord<E> = {
			failure: input.failure,
			kind: dispatchKind,
			submittedCount: input.submittedCount,
		};
		let outcome: ReconciliationOutcome<E, R> = {
			derived: ZERO_DERIVED_COUNTS,
			dispatch,
			durationMs: 0,
			failure: { dispatch, kind: "DispatchFailed" },
			id,
			operationId: input.operationId,
			recovery: { kind: "NotNeeded" },
			source: input.source,
			stages: ZERO_STAGE_DURATIONS,
			startedAt,
			status:
				dispatchKind === "ExecutionUncertain"
					? "PartialFailure"
					: "Failed",
			treeActions: {
				changed: 0,
				failed: 0,
				noOp: 0,
				requested: 0,
			},
		};

		if (dispatchKind === "ExecutionUncertain") {
			outcome = yield* this.resynchronize(outcome);
		} else {
			const endedAt = yield* Clock.currentTimeMillis;
			outcome = { ...outcome, durationMs: endedAt - startedAt };
		}

		yield* audit.record(outcome);
		return outcome;
	});

	private readonly resynchronize = Effect.fn(
		"LibraryReconciler.resynchronize",
	)(function* (
		this: LibraryReconciler<E, R>,
		outcome: ReconciliationOutcome<E, R>,
	): Effect.fn.Return<ReconciliationOutcome<E, R>> {
		const recoveryStartedAt = yield* Clock.currentTimeMillis;
		const recover = this.options.recover;
		if (!recover) {
			return yield* this.unavailableAfter(
				outcome,
				recoveryStartedAt,
				outcome.failure ?? outcome,
			);
		}

		const recoveryInput = yield* recover().pipe(
			Effect.result,
			Effect.catchCause((cause) =>
				Effect.succeed<Result.Result<ReconciliationRecoveryInput, R>>(
					Result.fail(this.options.unexpectedRecoveryFailure(cause)),
				),
			),
		);
		if (Result.isFailure(recoveryInput)) {
			return yield* this.unavailableAfter(
				outcome,
				recoveryStartedAt,
				recoveryInput.failure,
			);
		}
		const recoveryAttempt = yield* this.attempt(
			`${outcome.id}:recovery`,
			recoveryStartedAt,
			recoveryInput.success.healer,
			recoveryInput.success.request,
		);
		if (!recoveryAttempt.candidate) {
			return yield* this.unavailableAfter(
				outcome,
				recoveryStartedAt,
				recoveryAttempt.outcome.failure ?? recoveryAttempt.outcome,
			);
		}
		yield* this.commit(recoveryAttempt.candidate);
		const endedAt = yield* Clock.currentTimeMillis;
		return {
			...outcome,
			durationMs: endedAt - outcome.startedAt,
			recovery: { kind: "Resynchronized" },
			stages: {
				...outcome.stages,
				recoveryMs: endedAt - recoveryStartedAt,
			},
		};
	});

	/** `outcome`, whose recovery failed for `cause`: no reconciliation runs after it. */
	private readonly unavailableAfter = Effect.fnUntraced(function* (
		this: LibraryReconciler<E, R>,
		outcome: ReconciliationOutcome<E, R>,
		recoveryStartedAt: number,
		cause: unknown,
	): Effect.fn.Return<ReconciliationOutcome<E, R>> {
		yield* this.markUnavailable(cause);
		const endedAt = yield* Clock.currentTimeMillis;
		return {
			...outcome,
			durationMs: endedAt - outcome.startedAt,
			recovery: { cause, kind: "Failed" },
			stages: {
				...outcome.stages,
				recoveryMs: endedAt - recoveryStartedAt,
			},
		};
	});

	private readonly attempt = Effect.fn("LibraryReconciler.attempt")(
		function* (
			this: LibraryReconciler<E, R>,
			id: string,
			startedAt: number,
			baseHealer: Healer,
			request: ReconciliationRequest,
		): Effect.fn.Return<AttemptResult<E, R>> {
			const staged = baseHealer.fork();
			const results: HealerApplyResult[] = [];
			let applyFailure: ReconciliationFailure<E> | undefined;
			const applyStartedAt = yield* Clock.currentTimeMillis;

			for (const [actionIndex, action] of request.treeActions.entries()) {
				// A Tree Action that cannot be applied is a `TreeActionError`.
				// Anything that throws here is a bug, and is recorded the same
				// way, so the reconciler still resynchronizes after it.
				const applied = Result.flatMap(
					Result.try(() => staged.getHealingActionsFor(action)),
					(result): Result.Result<HealerApplyResult, unknown> =>
						result,
				);
				if (Result.isFailure(applied)) {
					applyFailure = {
						action,
						actionIndex,
						cause: applied.failure,
						kind: "TreeActionFailed",
					};
					break;
				}
				results.push(applied.success);
			}

			const applyEndedAt = yield* Clock.currentTimeMillis;
			const treeActions = this.treeActionCounts(
				request.treeActions.length,
				results,
				applyFailure === undefined ? 0 : 1,
			);
			if (applyFailure) {
				const endedAt = yield* Clock.currentTimeMillis;
				return {
					outcome: {
						derived: ZERO_DERIVED_COUNTS,
						dispatch: { kind: "NotRequired" },
						durationMs: endedAt - startedAt,
						failure: applyFailure,
						id,
						operationId: request.operationId,
						recovery: { kind: "NotNeeded" },
						source: request.source,
						stages: {
							...ZERO_STAGE_DURATIONS,
							applyMs: applyEndedAt - applyStartedAt,
						},
						startedAt,
						status: "Failed",
						treeActions,
					},
				};
			}

			const deriveStartedAt = yield* Clock.currentTimeMillis;
			// Filled as deriving goes, so a derivation that throws keeps them.
			const issues: LibraryIssue[] = [];
			// Deriving throws only when one of library-core's documented
			// invariants is broken: a codex path for a chain the Tree holds.
			const derivation = Result.try(() =>
				this.derive(staged, request, results, issues),
			);
			if (Result.isFailure(derivation)) {
				const cause = derivation.failure;
				yield* logLibraryIssues(issues);
				const deriveEndedAt = yield* Clock.currentTimeMillis;
				return {
					outcome: {
						derived: ZERO_DERIVED_COUNTS,
						dispatch: { kind: "NotRequired" },
						durationMs: deriveEndedAt - startedAt,
						failure: { cause, kind: "DerivationFailed" },
						id,
						operationId: request.operationId,
						recovery: { kind: "NotNeeded" },
						source: request.source,
						stages: {
							...ZERO_STAGE_DURATIONS,
							applyMs: applyEndedAt - applyStartedAt,
							deriveMs: deriveEndedAt - deriveStartedAt,
						},
						startedAt,
						status: "Failed",
						treeActions,
					},
				};
			}
			const derived = derivation.success;
			const deriveEndedAt = yield* Clock.currentTimeMillis;
			yield* logLibraryIssues(issues);
			const derivedCounts = this.derivedCounts(derived);

			if (derived.vault.length === 0) {
				const endedAt = yield* Clock.currentTimeMillis;
				return {
					candidate: staged,
					outcome: {
						derived: derivedCounts,
						dispatch: { kind: "NotRequired" },
						durationMs: endedAt - startedAt,
						id,
						operationId: request.operationId,
						recovery: { kind: "NotNeeded" },
						source: request.source,
						stages: {
							...ZERO_STAGE_DURATIONS,
							applyMs: applyEndedAt - applyStartedAt,
							deriveMs: deriveEndedAt - deriveStartedAt,
						},
						startedAt,
						status: treeActions.changed === 0 ? "NoOp" : "Success",
						treeActions,
					},
				};
			}

			const dispatchStartedAt = yield* Clock.currentTimeMillis;
			const dispatchResult = yield* this.options
				.dispatch(derived.vault)
				.pipe(
					Effect.result,
					Effect.catchCause((cause) =>
						Effect.succeed<Result.Result<void, E>>(
							Result.fail(
								this.options.unexpectedDispatchFailure(cause),
							),
						),
					),
				);
			const dispatchEndedAt = yield* Clock.currentTimeMillis;

			if (Result.isSuccess(dispatchResult)) {
				return {
					candidate: staged,
					outcome: {
						derived: derivedCounts,
						dispatch: {
							kind: "Completed",
							submittedCount: derived.vault.length,
						},
						durationMs: dispatchEndedAt - startedAt,
						id,
						operationId: request.operationId,
						recovery: { kind: "NotNeeded" },
						source: request.source,
						stages: {
							applyMs: applyEndedAt - applyStartedAt,
							deriveMs: deriveEndedAt - deriveStartedAt,
							dispatchMs: dispatchEndedAt - dispatchStartedAt,
							recoveryMs: 0,
						},
						startedAt,
						status: "Success",
						treeActions,
					},
				};
			}

			const dispatchKind = this.options.classifyDispatchFailure(
				dispatchResult.failure,
			);
			const dispatch: ReconciliationDispatchRecord<E> = {
				failure: dispatchResult.failure,
				kind: dispatchKind,
				submittedCount: derived.vault.length,
			};

			return {
				outcome: {
					derived: derivedCounts,
					dispatch,
					durationMs: dispatchEndedAt - startedAt,
					failure: { dispatch, kind: "DispatchFailed" },
					id,
					operationId: request.operationId,
					recovery: { kind: "NotNeeded" },
					source: request.source,
					stages: {
						applyMs: applyEndedAt - applyStartedAt,
						deriveMs: deriveEndedAt - deriveStartedAt,
						dispatchMs: dispatchEndedAt - dispatchStartedAt,
						recoveryMs: 0,
					},
					startedAt,
					status:
						dispatchKind === "ExecutionUncertain"
							? "PartialFailure"
							: "Failed",
					treeActions,
				},
			};
		},
	);

	/** The actions `results` call for; what it skips goes into `issues`. */
	private derive(
		staged: Healer,
		request: ReconciliationRequest,
		results: readonly HealerApplyResult[],
		issues: LibraryIssue[],
	): DerivedActions {
		const impacts = results.map((result) => result.codexImpact);
		const mergedImpact = mergeCodexImpacts(impacts);
		const codexDeletions = codexImpactToDeletions(
			mergedImpact,
			staged,
			this.codecs,
		);
		const recreations =
			request.source === "Startup"
				? codexImpactToRecreations(mergedImpact, staged, this.codecs)
				: codexImpactToIncrementalRecreations(
						mergedImpact,
						staged,
						this.codecs,
					);
		const codexRecreations = recreations.actions;
		issues.push(...recreations.issues);
		const changedActions = results.flatMap((result) =>
			result.changed ? [result.appliedAction] : [],
		);
		const statuses =
			request.source === "Startup"
				? { actions: [], issues: [] }
				: extractScrollStatusActions(changedActions, this.codecs);
		const statusProjections = statuses.actions;
		issues.push(...statuses.issues);
		const healing = results.flatMap((result) => result.healingActions);
		const supplemental = [...request.supplemental.invalidCodexDeletions];

		if (request.source === "Startup") {
			supplemental.push(
				...findInvalidCodexFiles(
					request.observedVaultPaths,
					staged,
					this.codecs,
				),
			);
			const mdPaths = request.observedVaultPaths.flatMap((path) => {
				if (path.kind !== SplitPathKind.MdFile) return [];
				const { read: _read, ...splitPath } = path;
				return [splitPath as SplitPathToMdFileInsideLibrary];
			});
			supplemental.push(
				...scanAndGenerateOrphanActions(staged, this.codecs, mdPaths)
					.cleanupActions,
			);
		}
		const uniqueSupplemental = [
			...new Map(
				supplemental.map((action) => [JSON.stringify(action), action]),
			).values(),
		];

		const backlinks =
			request.source === "Startup"
				? getBacklinkHealingVaultActions(staged, this.codecs)
				: getIncrementalBacklinkHealingVaultActions(
						staged,
						results,
						this.codecs,
					);
		const allHealing = [
			...healing,
			...uniqueSupplemental,
			...codexDeletions,
		];
		const vault = [
			...healingActionsToVaultActions(allHealing, this.codecs),
			...codexActionsToVaultActions(
				[...codexRecreations, ...statusProjections],
				this.codecs,
			),
			...backlinks,
		];

		return {
			backlinks,
			codexDeletions,
			codexRecreations,
			healing,
			statusProjections,
			supplemental: uniqueSupplemental,
			vault,
		};
	}

	private treeActionCounts(
		requested: number,
		results: readonly HealerApplyResult[],
		failed: number,
	): ReconciliationTreeActionCounts {
		const changed = results.filter((result) => result.changed).length;
		return {
			changed,
			failed,
			noOp: results.length - changed,
			requested,
		};
	}

	private derivedCounts(
		derived: DerivedActions,
	): ReconciliationDerivedCounts {
		return {
			backlink: derived.backlinks.length,
			codexDeletion: derived.codexDeletions.length,
			codexRecreation: derived.codexRecreations.length,
			healing: derived.healing.length,
			statusProjection: derived.statusProjections.length,
			supplemental: derived.supplemental.length,
			vault: derived.vault.length,
		};
	}
}
