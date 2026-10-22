import type { SplitPathToFolder } from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Predicate } from "effect";
import type { SuffixDelimiterConfig } from "../../../types";
import type {
	DelimiterActionFailure,
	DelimiterChangeService,
	DelimiterMigrationExecution,
} from "./delimiter-change-service";
import type {
	DelimiterMigrationPlan,
	DelimiterRenameAction,
} from "./delimiter-migration-plan";

type DelimiterMigrationStage =
	| "Confirmation"
	| "Dispatch"
	| "Pause"
	| "Planning"
	| "Restore";

type DelimiterMigrationProblem = {
	readonly cause: unknown;
	readonly operation: string;
	readonly stage: DelimiterMigrationStage;
};

type PlannedOutcome = {
	readonly plan: DelimiterMigrationPlan;
};

export type DelimiterMigrationOutcome =
	| (PlannedOutcome & { readonly kind: "Cancelled" })
	| (PlannedOutcome & {
			readonly kind: "Completed";
			readonly renamedCount: number;
			readonly succeeded: readonly DelimiterRenameAction[];
	  })
	| {
			/**
			 * What the renames did before the failure, when they ran. Absent
			 * or `RolledBack`: every note keeps its old name. `Completed`:
			 * every note carries the new delimiter.
			 */
			readonly execution?: DelimiterMigrationExecution;
			readonly failures: readonly DelimiterActionFailure[];
			readonly kind: "Failed";
			readonly plan?: DelimiterMigrationPlan;
			readonly problem: DelimiterMigrationProblem;
	  }
	| (PlannedOutcome & { readonly kind: "NoOp" })
	| (PlannedOutcome & {
			readonly execution: Extract<
				DelimiterMigrationExecution,
				{ kind: "RollbackIncomplete" }
			>;
			readonly failures: readonly DelimiterActionFailure[];
			/** The old delimiter is kept, but some notes still carry the new one. */
			readonly kind: "RollbackIncomplete";
	  });

export type DelimiterMigrationLifecycle = {
	readonly confirm: (
		plan: DelimiterMigrationPlan,
	) => Effect.Effect<boolean, unknown>;
	readonly pause: () => Effect.Effect<void, unknown>;
	readonly restore: (
		config: Readonly<SuffixDelimiterConfig>,
		context: { readonly currentAlreadyPaused: boolean },
	) => Effect.Effect<void, unknown>;
};

/**
 * Owns the migration lifecycle around the pure plan and VAM executor. The
 * stored delimiter becomes the new one only when every rename succeeded;
 * otherwise the renames are undone and the old delimiter is restored.
 */
export class DelimiterMigrationCoordinator {
	constructor(
		private readonly service: DelimiterChangeService,
		private readonly lifecycle: DelimiterMigrationLifecycle,
	) {}

	readonly migrate = Effect.fn("DelimiterMigrationCoordinator.migrate")(
		function* (
			this: DelimiterMigrationCoordinator,
			oldConfig: SuffixDelimiterConfig,
			newConfig: SuffixDelimiterConfig,
			libraryRoot: SplitPathToFolder,
		) {
			const planExit = yield* Effect.exit(
				this.service.plan(oldConfig, newConfig, libraryRoot),
			);
			if (Exit.isFailure(planExit)) {
				return failed(
					problem("Planning", failureFromCause(planExit.cause)),
				);
			}

			const plan = planExit.value;
			if (plan.kind === "NoOp") {
				return Object.freeze({ kind: "NoOp" as const, plan });
			}

			if (plan.actions.length === 0) {
				const restoreExit = yield* Effect.exit(
					this.lifecycle.restore(plan.newConfig, {
						currentAlreadyPaused: false,
					}),
				);
				if (Exit.isFailure(restoreExit)) {
					return failed(
						problem("Restore", failureFromCause(restoreExit.cause)),
						{ plan },
					);
				}
				return completed(plan, []);
			}

			const confirmationExit = yield* Effect.exit(
				this.lifecycle.confirm(plan),
			);
			if (Exit.isFailure(confirmationExit)) {
				return failed(
					problem(
						"Confirmation",
						failureFromCause(confirmationExit.cause),
					),
					{ plan },
				);
			}
			if (!confirmationExit.value) {
				return Object.freeze({ kind: "Cancelled" as const, plan });
			}

			const pauseExit = yield* Effect.exit(this.lifecycle.pause());
			if (Exit.isFailure(pauseExit)) {
				return yield* this.restoreAfterFailure(
					plan,
					failed(
						problem("Pause", failureFromCause(pauseExit.cause)),
						{ plan },
					),
					false,
				);
			}

			const executionExit = yield* Effect.exit(
				this.service.execute(plan),
			);
			if (Exit.isFailure(executionExit)) {
				return yield* this.restoreAfterFailure(
					plan,
					failed(
						problem(
							"Dispatch",
							failureFromCause(executionExit.cause),
						),
						{ plan },
					),
					true,
				);
			}

			const execution = executionExit.value;
			const config =
				execution.kind === "Completed"
					? plan.newConfig
					: plan.oldConfig;
			const restoreExit = yield* Effect.exit(
				this.lifecycle.restore(config, { currentAlreadyPaused: true }),
			);
			if (Exit.isFailure(restoreExit)) {
				return failed(
					problem("Restore", failureFromCause(restoreExit.cause)),
					{
						execution,
						failures: executionFailures(execution),
						plan,
					},
				);
			}

			return outcomeFromExecution(plan, execution);
		},
	);

	private readonly restoreAfterFailure = Effect.fn(
		"DelimiterMigrationCoordinator.restoreAfterFailure",
	)(function* (
		this: DelimiterMigrationCoordinator,
		plan: DelimiterMigrationPlan,
		outcome: Extract<DelimiterMigrationOutcome, { kind: "Failed" }>,
		currentAlreadyPaused: boolean,
	) {
		const restoreExit = yield* Effect.exit(
			this.lifecycle.restore(plan.oldConfig, {
				currentAlreadyPaused,
			}),
		);
		if (Exit.isSuccess(restoreExit)) return outcome;
		return failed(problem("Restore", failureFromCause(restoreExit.cause)), {
			failures: outcome.failures,
			plan,
		});
	});
}

function outcomeFromExecution(
	plan: DelimiterMigrationPlan,
	execution: DelimiterMigrationExecution,
): DelimiterMigrationOutcome {
	if (execution.kind === "Completed") {
		return completed(plan, execution.succeeded);
	}
	if (execution.kind === "RollbackIncomplete") {
		return Object.freeze({
			execution,
			failures: executionFailures(execution),
			kind: "RollbackIncomplete" as const,
			plan,
		});
	}
	return failed(
		problem(
			"Dispatch",
			execution.failure.cause,
			execution.failure.operation,
		),
		{
			execution,
			failures: executionFailures(execution),
			plan,
		},
	);
}

/** The forward failure first, then any failed attempt to rename back. */
function executionFailures(
	execution: DelimiterMigrationExecution,
): readonly DelimiterActionFailure[] {
	switch (execution.kind) {
		case "Completed":
			return [];
		case "RolledBack":
			return [execution.failure];
		case "RollbackIncomplete":
			return [execution.failure, ...execution.rollbackFailures];
	}
}

function completed(
	plan: DelimiterMigrationPlan,
	succeeded: readonly DelimiterRenameAction[],
): DelimiterMigrationOutcome {
	return Object.freeze({
		kind: "Completed" as const,
		plan,
		renamedCount: succeeded.length,
		succeeded,
	});
}

function failed(
	problemValue: DelimiterMigrationProblem,
	context: {
		readonly execution?: DelimiterMigrationExecution;
		readonly failures?: readonly DelimiterActionFailure[];
		readonly plan?: DelimiterMigrationPlan;
	} = {},
): Extract<DelimiterMigrationOutcome, { kind: "Failed" }> {
	return Object.freeze({
		...context,
		failures: context.failures ?? [],
		kind: "Failed" as const,
		problem: problemValue,
	});
}

function problem(
	stage: DelimiterMigrationStage,
	cause: unknown,
	knownOperation?: string,
): DelimiterMigrationProblem {
	const operation =
		knownOperation ??
		(Predicate.hasProperty(cause, "operation") &&
		Predicate.isString(cause.operation)
			? cause.operation
			: stage.toLowerCase());
	return Object.freeze({ cause, operation, stage });
}

function failureFromCause(cause: Cause.Cause<unknown>): unknown {
	const reason = cause.reasons.find(Cause.isFailReason);
	return reason ? reason.error : Cause.squash(cause);
}
