import type {
	SplitPathToFolder,
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { splitPathCodec } from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Predicate } from "effect";
import type { SuffixDelimiterConfig } from "../../../types";
import {
	type DelimiterMigrationPlan,
	type DelimiterRenameAction,
	planDelimiterMigration,
} from "./delimiter-migration-plan";

export type DelimiterMigrationVam = {
	readonly dispatch: (
		actions: readonly VaultAction[],
	) => ReturnType<VaultActionManager["dispatch"]>;
	readonly listAllFilesWithMdReaders: (
		root: SplitPathToFolder,
	) => ReturnType<VaultActionManager["listAllFilesWithMdReaders"]>;
};

export type DelimiterActionFailure = {
	readonly action: DelimiterRenameAction;
	readonly cause: unknown;
	readonly operation: string;
	readonly path: string;
};

export type DelimiterMigrationExecution =
	| {
			readonly kind: "Completed";
			readonly renamedCount: number;
			readonly succeeded: readonly DelimiterRenameAction[];
	  }
	| {
			readonly failures: readonly DelimiterActionFailure[];
			readonly kind: "Failed";
			readonly renamedCount: 0;
			readonly succeeded: readonly [];
	  }
	| {
			readonly failures: readonly DelimiterActionFailure[];
			readonly kind: "PartiallyFailed";
			readonly renamedCount: number;
			readonly succeeded: readonly DelimiterRenameAction[];
	  };

/** Plans and executes delimiter renames exclusively through the public VAM. */
export class DelimiterChangeService {
	constructor(private readonly vam: DelimiterMigrationVam) {}

	readonly plan = Effect.fn("DelimiterChangeService.plan")(function* (
		this: DelimiterChangeService,
		oldConfig: SuffixDelimiterConfig,
		newConfig: SuffixDelimiterConfig,
		libraryRoot: SplitPathToFolder,
	) {
		const configOnlyPlan = planDelimiterMigration({
			candidates: [],
			libraryRoot,
			newConfig,
			oldConfig,
		});
		if (configOnlyPlan.kind === "NoOp") return configOnlyPlan;

		const paths = yield* this.vam.listAllFilesWithMdReaders(libraryRoot);
		const candidates = paths.flatMap((candidate) => {
			if (candidate.kind !== "MdFile") return [];
			const { read: _read, ...path } = candidate;
			return [path];
		});

		return planDelimiterMigration({
			candidates,
			libraryRoot,
			newConfig,
			oldConfig,
		});
	});

	readonly execute = Effect.fn("DelimiterChangeService.execute")(function* (
		this: DelimiterChangeService,
		plan: DelimiterMigrationPlan,
	) {
		if (plan.actions.length === 0) {
			return completed([]);
		}

		const exit = yield* Effect.exit(this.vam.dispatch(plan.actions));
		if (Exit.isSuccess(exit)) return completed(plan.actions);

		const dispatchFailure = failureFromCause(exit.cause);
		const failures = correlateFailures(plan.actions, dispatchFailure);
		const failedActions = new Set(failures.map(({ action }) => action));
		const succeeded = plan.actions.filter(
			(action) => !failedActions.has(action),
		);

		if (succeeded.length === 0) {
			return Object.freeze({
				failures: Object.freeze(failures),
				kind: "Failed" as const,
				renamedCount: 0 as const,
				succeeded: Object.freeze([]) as readonly [],
			});
		}

		return Object.freeze({
			failures: Object.freeze(failures),
			kind: "PartiallyFailed" as const,
			renamedCount: succeeded.length,
			succeeded: Object.freeze(succeeded),
		});
	});
}

function completed(
	succeeded: readonly DelimiterRenameAction[],
): DelimiterMigrationExecution {
	return Object.freeze({
		kind: "Completed" as const,
		renamedCount: succeeded.length,
		succeeded: Object.freeze([...succeeded]),
	});
}

function failureFromCause(cause: Cause.Cause<unknown>): unknown {
	const reason = cause.reasons.find(Cause.isFailReason);
	return reason ? reason.error : Cause.squash(cause);
}

function correlateFailures(
	actions: readonly DelimiterRenameAction[],
	failure: unknown,
): DelimiterActionFailure[] {
	if (!Array.isArray(failure) || isBatchWideFailure(failure)) {
		return actions.map((action) => describeFailure(action, failure));
	}

	const correlated = failure.flatMap((item) => {
		const action = findFailedAction(actions, item);
		return action ? [describeFailure(action, item)] : [];
	});

	return correlated.length > 0
		? correlated
		: actions.map((action) => describeFailure(action, failure));
}

function isBatchWideFailure(failure: readonly unknown[]): boolean {
	return failure.some(
		(item) =>
			Predicate.hasProperty(item, "operation") &&
			item.operation === "registerSelfEvents",
	);
}

function findFailedAction(
	actions: readonly DelimiterRenameAction[],
	failure: unknown,
): DelimiterRenameAction | undefined {
	if (!Predicate.hasProperty(failure, "action")) return undefined;
	const action = failure.action;
	return actions.find((candidate) => candidate === action);
}

function describeFailure(
	action: DelimiterRenameAction,
	failure: unknown,
): DelimiterActionFailure {
	const operation =
		Predicate.hasProperty(failure, "operation") &&
		Predicate.isString(failure.operation)
			? failure.operation
			: "dispatch";
	const cause = Predicate.hasProperty(failure, "cause")
		? failure.cause
		: failure;

	return Object.freeze({
		action,
		cause,
		operation,
		path: `${splitPathCodec.format(action.payload.from)} → ${splitPathCodec.format(action.payload.to)}`,
	});
}
