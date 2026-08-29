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
	mergeCodexImpacts,
	type SplitPathToMdFileInsideLibrary,
	scanAndGenerateOrphanActions,
	type TreeAction,
} from "@textfresser/library-core";
import {
	SplitPathKind,
	type VaultAction,
	type VaultScanPath,
} from "@textfresser/vault-action-manager";
import { Clock, Effect, Result } from "effect";

export type ReconciliationSource =
	| "Startup"
	| "ObservedBulk"
	| "CodexClick"
	| "CommandIntention";

type ReconciliationSupplementalObservations = {
	readonly invalidCodexDeletions: readonly HealingAction[];
};

type RuntimeReconciliationRequest = {
	readonly source: Exclude<ReconciliationSource, "Startup">;
	readonly supplemental: ReconciliationSupplementalObservations;
	readonly treeActions: readonly TreeAction[];
};

export type StartupReconciliationRequest = {
	readonly observedVaultPaths: readonly VaultScanPath[];
	readonly source: "Startup";
	readonly supplemental: ReconciliationSupplementalObservations;
	readonly treeActions: readonly TreeAction[];
};

export type ReconciliationRequest =
	| RuntimeReconciliationRequest
	| StartupReconciliationRequest;

/** Classify the VAM boundary by whether action execution could have started. */
export function classifyVamDispatchFailure(
	failure: unknown,
): "FailedBeforeExecution" | "ExecutionUncertain" {
	if (!Array.isArray(failure)) return "FailedBeforeExecution";
	return failure.some(
		(item) =>
			typeof item === "object" &&
			item !== null &&
			"operation" in item &&
			item.operation === "executeAction",
	)
		? "ExecutionUncertain"
		: "FailedBeforeExecution";
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

export type ReconciliationStageDurations = {
	readonly applyMs: number;
	readonly deriveMs: number;
	readonly dispatchMs: number;
	readonly recoveryMs: number;
};

export type ReconciliationDispatchRecord<E> =
	| { readonly kind: "NotRequired" }
	| { readonly kind: "Completed"; readonly submittedCount: number }
	| {
			readonly failure: E;
			readonly kind: "FailedBeforeExecution" | "ExecutionUncertain";
			readonly submittedCount: number;
	  };

export type ReconciliationRecoveryRecord<R> =
	| { readonly kind: "NotNeeded" }
	| { readonly kind: "StagedStateDiscarded" }
	| { readonly kind: "Resynchronized" }
	| { readonly cause: R | unknown; readonly kind: "Failed" };

export type ReconciliationFailure<E> =
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

export type ReconciliationStatus =
	| "Success"
	| "NoOp"
	| "Failed"
	| "PartialFailure";

export type ReconciliationOutcome<E, R = unknown> = {
	readonly derived: ReconciliationDerivedCounts;
	readonly dispatch: ReconciliationDispatchRecord<E>;
	readonly durationMs: number;
	readonly failure?: ReconciliationFailure<E>;
	readonly id: string;
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

export class ReconciliationAuditLog<E, R = unknown> {
	private readonly entries: ReconciliationOutcome<E, R>[] = [];
	private nextId = 0;

	constructor(private readonly maxEntries = 1_000) {}

	allocateId(): string {
		this.nextId += 1;
		return `reconcile-${this.nextId}`;
	}

	record(outcome: ReconciliationOutcome<E, R>): void {
		this.entries.push(outcome);
		if (this.entries.length > this.maxEntries) this.entries.shift();
	}

	getRecent(count = 10): readonly ReconciliationOutcome<E, R>[] {
		return this.entries.slice(-count);
	}
}

/**
 * Owns the complete Tree Action -> VAM reconciliation boundary.
 *
 * Each request is applied to a fork of the last acknowledged Tree. The fork is
 * published only after dispatch completes. Failures are total, audited
 * outcomes; execution-uncertain dispatch failures require a vault-backed
 * recovery before the reconciler accepts later work.
 */
export class LibraryReconciler<E, R = unknown> {
	private healer: Healer;
	private unavailableCause: unknown | undefined;

	constructor(
		healer: Healer,
		private readonly codecs: Codecs,
		private readonly options: LibraryReconcilerOptions<E, R>,
	) {
		this.healer = healer;
	}

	getCommittedHealer(): Healer {
		return this.healer;
	}

	getAuditLog(): ReconciliationAuditLog<E, R> {
		return this.options.audit ?? this.fallbackAudit;
	}

	private readonly fallbackAudit = new ReconciliationAuditLog<E, R>();

	readonly reconcile = Effect.fn("LibraryReconciler.reconcile")(function* (
		this: LibraryReconciler<E, R>,
		request: ReconciliationRequest,
	): Effect.fn.Return<ReconciliationOutcome<E, R>> {
		const audit = this.getAuditLog();
		const id = audit.allocateId();
		const startedAt = yield* Clock.currentTimeMillis;

		if (this.unavailableCause !== undefined) {
			const endedAt = yield* Clock.currentTimeMillis;
			const outcome: ReconciliationOutcome<E, R> = {
				derived: ZERO_DERIVED_COUNTS,
				dispatch: { kind: "NotRequired" },
				durationMs: endedAt - startedAt,
				failure: {
					cause: this.unavailableCause,
					kind: "ReconciliationUnavailable",
				},
				id,
				recovery: { cause: this.unavailableCause, kind: "Failed" },
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
			audit.record(outcome);
			return outcome;
		}

		const attempt = yield* this.attempt(
			id,
			startedAt,
			this.healer,
			request,
		);
		let outcome = attempt.outcome;

		if (attempt.candidate) {
			this.healer = attempt.candidate;
			audit.record(outcome);
			return outcome;
		}

		const recover = this.options.recover;
		const needsVaultRecovery = request.source !== "Startup" && recover;
		if (needsVaultRecovery) {
			const recoveryStartedAt = yield* Clock.currentTimeMillis;
			const recoveryInput = yield* Effect.result(recover());

			if (Result.isSuccess(recoveryInput)) {
				const recoveryAttempt = yield* this.attempt(
					`${id}:recovery`,
					recoveryStartedAt,
					recoveryInput.success.healer,
					recoveryInput.success.request,
				);
				if (recoveryAttempt.candidate) {
					this.healer = recoveryAttempt.candidate;
					this.unavailableCause = undefined;
					const endedAt = yield* Clock.currentTimeMillis;
					outcome = {
						...outcome,
						durationMs: endedAt - startedAt,
						recovery: { kind: "Resynchronized" },
						stages: {
							...outcome.stages,
							recoveryMs: endedAt - recoveryStartedAt,
						},
					};
					audit.record(outcome);
					return outcome;
				}

				this.unavailableCause =
					recoveryAttempt.outcome.failure ?? recoveryAttempt.outcome;
			} else {
				this.unavailableCause = recoveryInput.failure;
			}

			const endedAt = yield* Clock.currentTimeMillis;
			outcome = {
				...outcome,
				durationMs: endedAt - startedAt,
				recovery: {
					cause: this.unavailableCause,
					kind: "Failed",
				},
				stages: {
					...outcome.stages,
					recoveryMs: endedAt - recoveryStartedAt,
				},
			};
		} else if (outcome.dispatch.kind === "ExecutionUncertain") {
			this.unavailableCause = outcome.failure;
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

		audit.record(outcome);
		return outcome;
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
				try {
					results.push(staged.getHealingActionsFor(action));
				} catch (cause) {
					applyFailure = {
						action,
						actionIndex,
						cause,
						kind: "TreeActionFailed",
					};
					break;
				}
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
			let derived: DerivedActions;
			try {
				derived = this.derive(staged, request, results);
			} catch (cause) {
				const deriveEndedAt = yield* Clock.currentTimeMillis;
				return {
					outcome: {
						derived: ZERO_DERIVED_COUNTS,
						dispatch: { kind: "NotRequired" },
						durationMs: deriveEndedAt - startedAt,
						failure: { cause, kind: "DerivationFailed" },
						id,
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
			const deriveEndedAt = yield* Clock.currentTimeMillis;
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
			const dispatchResult = yield* Effect.result(
				this.options.dispatch(derived.vault),
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

	private derive(
		staged: Healer,
		request: ReconciliationRequest,
		results: readonly HealerApplyResult[],
	): DerivedActions {
		const impacts = results.map((result) => result.codexImpact);
		const mergedImpact = mergeCodexImpacts(impacts);
		const codexDeletions = codexImpactToDeletions(
			mergedImpact,
			staged,
			this.codecs,
		);
		const codexRecreations =
			request.source === "Startup"
				? codexImpactToRecreations(mergedImpact, staged, this.codecs)
				: codexImpactToIncrementalRecreations(
						mergedImpact,
						staged,
						this.codecs,
					);
		const changedActions = results.flatMap((result) =>
			result.changed ? [result.appliedAction] : [],
		);
		const statusProjections =
			request.source === "Startup"
				? []
				: extractScrollStatusActions(changedActions, this.codecs);
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
