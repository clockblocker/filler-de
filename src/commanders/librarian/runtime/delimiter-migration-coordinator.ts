import type { SplitPathToFolder } from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Predicate } from "effect";
import type { SuffixDelimiterConfig } from "../../../types";
import { causeValues } from "../../../utils/causes";
import type {
	DelimiterActionFailure,
	DelimiterChangeService,
	DelimiterDispatchFailure,
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

/** What planning fails with: the scan, or names already in use. */
export type DelimiterPlanFailure = Effect.Error<
	ReturnType<DelimiterChangeService["plan"]>
>;

/** What a migration's stage fails with, beside its lifecycle's `E`. */
export type DelimiterStageFailure =
	| DelimiterPlanFailure
	| DelimiterDispatchFailure;

/**
 * The stage that failed, and every reason it failed: what the plan, the
 * renames or the lifecycle (`E`) failed with, and any defect beside it.
 */
type DelimiterMigrationProblem<E> = {
	readonly cause: Cause.Cause<DelimiterStageFailure | E>;
	readonly operation: string;
	readonly stage: DelimiterMigrationStage;
};

type PlannedOutcome = {
	readonly plan: DelimiterMigrationPlan;
};

/** `E` is what the migration's lifecycle fails with. */
export type DelimiterMigrationOutcome<E> =
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
			readonly problem: DelimiterMigrationProblem<E>;
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

/** The confirmation and the Librarian's pause and restart, failing with `E`. */
export type DelimiterMigrationLifecycle<E> = {
	readonly confirm: (
		plan: DelimiterMigrationPlan,
	) => Effect.Effect<boolean, E>;
	readonly pause: () => Effect.Effect<void, E>;
	readonly restore: (
		config: Readonly<SuffixDelimiterConfig>,
		context: { readonly currentAlreadyPaused: boolean },
	) => Effect.Effect<void, E>;
};

/**
 * Owns the migration lifecycle around the pure plan and VAM executor. The
 * stored delimiter becomes the new one only when every rename succeeded;
 * otherwise the renames are undone and the old delimiter is restored.
 */
export class DelimiterMigrationCoordinator<E> {
	constructor(
		private readonly service: DelimiterChangeService,
		private readonly lifecycle: DelimiterMigrationLifecycle<E>,
	) {}

	readonly migrate = Effect.fn("DelimiterMigrationCoordinator.migrate")(
		function* (
			this: DelimiterMigrationCoordinator<E>,
			oldConfig: SuffixDelimiterConfig,
			newConfig: SuffixDelimiterConfig,
			libraryRoot: SplitPathToFolder,
		): Effect.fn.Return<DelimiterMigrationOutcome<E>> {
			const planExit = yield* Effect.exit(
				this.service.plan(oldConfig, newConfig, libraryRoot),
			);
			if (Exit.isFailure(planExit)) {
				return failed(problem<E>("Planning", planExit.cause));
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
					return failed(problem<E>("Restore", restoreExit.cause), {
						plan,
					});
				}
				return completed(plan, []);
			}

			const confirmationExit = yield* Effect.exit(
				this.lifecycle.confirm(plan),
			);
			if (Exit.isFailure(confirmationExit)) {
				return failed(
					problem<E>("Confirmation", confirmationExit.cause),
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
					failed(problem<E>("Pause", pauseExit.cause), { plan }),
					false,
				);
			}

			const executionExit = yield* Effect.exit(
				this.service.execute(plan),
			);
			if (Exit.isFailure(executionExit)) {
				return yield* this.restoreAfterFailure(
					plan,
					failed(problem<E>("Dispatch", executionExit.cause), {
						plan,
					}),
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
				return failed(problem<E>("Restore", restoreExit.cause), {
					execution,
					failures: executionFailures(execution),
					plan,
				});
			}

			return outcomeFromExecution(plan, execution);
		},
	);

	private readonly restoreAfterFailure = Effect.fn(
		"DelimiterMigrationCoordinator.restoreAfterFailure",
	)(function* (
		this: DelimiterMigrationCoordinator<E>,
		plan: DelimiterMigrationPlan,
		outcome: Extract<DelimiterMigrationOutcome<E>, { kind: "Failed" }>,
		currentAlreadyPaused: boolean,
	): Effect.fn.Return<DelimiterMigrationOutcome<E>> {
		const restoreExit = yield* Effect.exit(
			this.lifecycle.restore(plan.oldConfig, {
				currentAlreadyPaused,
			}),
		);
		if (Exit.isSuccess(restoreExit)) return outcome;
		return failed(problem<E>("Restore", restoreExit.cause), {
			failures: outcome.failures,
			plan,
		});
	});
}

function outcomeFromExecution<E>(
	plan: DelimiterMigrationPlan,
	execution: DelimiterMigrationExecution,
): DelimiterMigrationOutcome<E> {
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
		problem<E>(
			"Dispatch",
			execution.failure.dispatch,
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

function completed<E>(
	plan: DelimiterMigrationPlan,
	succeeded: readonly DelimiterRenameAction[],
): DelimiterMigrationOutcome<E> {
	return Object.freeze({
		kind: "Completed" as const,
		plan,
		renamedCount: succeeded.length,
		succeeded,
	});
}

function failed<E>(
	problemValue: DelimiterMigrationProblem<E>,
	context: {
		readonly execution?: DelimiterMigrationExecution;
		readonly failures?: readonly DelimiterActionFailure[];
		readonly plan?: DelimiterMigrationPlan;
	} = {},
): Extract<DelimiterMigrationOutcome<E>, { kind: "Failed" }> {
	return Object.freeze({
		...context,
		failures: context.failures ?? [],
		kind: "Failed" as const,
		problem: problemValue,
	});
}

/**
 * The stage's problem, with every reason in `cause`. Its operation is the
 * one the first failure or defect names, else the stage's.
 */
function problem<E>(
	stage: DelimiterMigrationStage,
	cause: Cause.Cause<DelimiterStageFailure | E>,
	knownOperation?: string,
): DelimiterMigrationProblem<E> {
	const operation =
		knownOperation ?? operationIn(cause) ?? stage.toLowerCase();
	return Object.freeze({ cause, operation, stage });
}

/**
 * The operation the first failure or defect in `cause` names. A wrapper
 * that names none, such as the lifecycle's `LibrarianStartFailed`, is read
 * through the cause it holds.
 */
function operationIn(
	cause: Cause.Cause<unknown>,
	depth = 0,
): string | undefined {
	const [first] = causeValues(cause);
	if (
		Predicate.hasProperty(first, "operation") &&
		Predicate.isString(first.operation)
	)
		return first.operation;
	if (depth >= 4 || !Predicate.hasProperty(first, "cause")) return undefined;
	const inner = first.cause;
	if (Cause.isCause(inner)) return operationIn(inner, depth + 1);
	return Predicate.hasProperty(inner, "operation") &&
		Predicate.isString(inner.operation)
		? inner.operation
		: undefined;
}
