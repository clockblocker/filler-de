import type {
	SplitPathToFolder,
	SplitPathToMdFile,
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import {
	splitPathCodec,
	VamDispatchOverflowError,
	VamDispatchStoppedError,
	VamPlanningError,
	VamSetupError,
	VamShutdownError,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { Cause, Effect, Exit, Predicate, Schema } from "effect";
import type { SuffixDelimiterConfig } from "../../../types";
import {
	type DelimiterMigrationPlan,
	type DelimiterRenameAction,
	type DelimiterRenameConflict,
	findDelimiterRenameConflicts,
	planDelimiterMigration,
} from "./delimiter-migration-plan";

export type DelimiterMigrationVam = {
	readonly dispatch: (
		actions: readonly VaultAction[],
	) => ReturnType<VaultActionManager["dispatch"]>;
	readonly dispatchStopOnFirstFailure: (
		actions: readonly VaultAction[],
	) => ReturnType<VaultActionManager["dispatchStopOnFirstFailure"]>;
	readonly exists: (
		path: SplitPathToMdFile,
	) => ReturnType<VaultActionManager["exists"]>;
	readonly scan: (
		root: SplitPathToFolder,
	) => ReturnType<VaultActionManager["scan"]>;
};

export type DelimiterActionFailure = {
	/** The planned rename concerned; absent when the batch failed as a whole. */
	readonly action?: DelimiterRenameAction;
	readonly cause: unknown;
	readonly operation: string;
	/** `from → to` of the rename that was attempted. */
	readonly path?: string;
};

/**
 * What a delimiter migration did to the vault. Every outcome but
 * `RollbackIncomplete` leaves all planned notes under one delimiter: the new
 * one after `Completed`, the old one after `RolledBack`.
 */
export type DelimiterMigrationExecution =
	| {
			readonly kind: "Completed";
			readonly renamedCount: number;
			readonly succeeded: readonly DelimiterRenameAction[];
	  }
	| {
			/** The failure that stopped the migration. */
			readonly failure: DelimiterActionFailure;
			readonly kind: "RolledBack";
			/** Renames that had succeeded and were renamed back. */
			readonly rolledBack: readonly DelimiterRenameAction[];
	  }
	| {
			readonly failure: DelimiterActionFailure;
			readonly kind: "RollbackIncomplete";
			/** Renames that succeeded and could not be renamed back. */
			readonly leftRenamed: readonly DelimiterRenameAction[];
			readonly rollbackFailures: readonly DelimiterActionFailure[];
			readonly rolledBack: readonly DelimiterRenameAction[];
			/**
			 * Renames whose note sits under neither or both names, so the
			 * migration could not tell, or set, its state.
			 */
			readonly unresolved: readonly DelimiterRenameAction[];
	  };

/** The plan would rename notes onto names already in use. Nothing was renamed. */
export class DelimiterRenameConflictError extends Schema.TaggedError<DelimiterRenameConflictError>()(
	"DelimiterRenameConflictError",
	{
		conflicts: Schema.Array(
			Schema.Struct({
				from: Schema.String,
				occupiedBy: Schema.String,
				reason: Schema.Literals(["SharedTarget", "TargetTaken"]),
				to: Schema.String,
			}),
		),
		operation: Schema.String,
	},
) {
	override get message(): string {
		const listed = this.conflicts
			.slice(0, 5)
			.map(({ from, occupiedBy, reason, to }) =>
				reason === "SharedTarget"
					? `${from} → ${to} (also the new name of ${occupiedBy})`
					: occupiedBy === to
						? `${from} → ${to} (already exists)`
						: `${from} → ${to} (${occupiedBy} already exists)`,
			)
			.join("; ");
		const more =
			this.conflicts.length > 5
				? `; and ${this.conflicts.length - 5} more`
				: "";
		return `${this.conflicts.length} rename(s) would land on a name already in use: ${listed}${more}`;
	}
}

type FileState = "New" | "Old" | "Unresolved";

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

		const scan = yield* this.vam.scan(libraryRoot);
		if (scan.kind === "Partial") {
			return yield* Effect.fail(scan.diagnostics);
		}
		const candidates = scan.entries.flatMap((candidate) => {
			if (candidate.kind !== "MdFile") return [];
			const { read: _read, ...path } = candidate;
			return [path];
		});

		const plan = planDelimiterMigration({
			candidates,
			libraryRoot,
			newConfig,
			oldConfig,
		});
		const conflicts = findDelimiterRenameConflicts(
			plan.actions,
			candidates,
		);
		if (conflicts.length > 0) {
			return yield* conflictError(conflicts);
		}
		return plan;
	});

	/**
	 * Renames the planned notes, stopping at the first failure. After a
	 * failure, every note the migration moved is renamed back, so the vault
	 * keeps the old delimiter throughout. The vault itself, not the batch
	 * report, decides which notes need renaming back and which made it.
	 */
	readonly execute = Effect.fn("DelimiterChangeService.execute")(function* (
		this: DelimiterChangeService,
		plan: DelimiterMigrationPlan,
	) {
		if (plan.actions.length === 0) {
			return completed([]);
		}

		const exit = yield* Effect.exit(
			this.vam.dispatchStopOnFirstFailure(plan.actions),
		);
		if (Exit.isSuccess(exit)) return completed(plan.actions);

		const dispatchFailure = failureFromCause(exit.cause);
		const failure = describeDispatchFailure(plan.actions, dispatchFailure);
		const touched = possiblyRenamed(plan.actions, dispatchFailure);
		if (touched.length === 0) return rolledBack(failure, []);

		const before = yield* this.observe(touched);
		const toRollBack = touched
			.filter((_, index) => before[index] === "New")
			.reverse();
		const rollbackFailures =
			toRollBack.length > 0 ? yield* this.rollBack(toRollBack) : [];

		const after = yield* this.observe(touched);
		const restored = touched.filter(
			(action, index) =>
				after[index] === "Old" && toRollBack.includes(action),
		);
		const leftRenamed = touched.filter(
			(_, index) => after[index] === "New",
		);
		const unresolved = touched.filter(
			(_, index) => after[index] === "Unresolved",
		);
		if (leftRenamed.length === 0 && unresolved.length === 0) {
			return rolledBack(failure, restored);
		}

		return Object.freeze({
			failure,
			kind: "RollbackIncomplete" as const,
			leftRenamed: Object.freeze(leftRenamed),
			rollbackFailures: Object.freeze(
				rollbackFailures.filter(
					({ action }) => action && !restored.includes(action),
				),
			),
			rolledBack: Object.freeze(restored),
			unresolved: Object.freeze(unresolved),
		});
	});

	/** Where each planned note sits now: under its old name, its new one, or neither. */
	private observe(
		actions: readonly DelimiterRenameAction[],
	): Effect.Effect<readonly FileState[]> {
		return Effect.forEach(actions, (action) =>
			Effect.all([
				this.vam.exists(action.payload.from),
				this.vam.exists(action.payload.to),
			]).pipe(
				Effect.map(([atOld, atNew]): FileState => {
					if (atOld && !atNew) return "Old";
					if (atNew && !atOld) return "New";
					return "Unresolved";
				}),
				Effect.catchCause(() =>
					Effect.succeed<FileState>("Unresolved"),
				),
			),
		);
	}

	/**
	 * Renames each note back to its old name. Every inverse rename is
	 * attempted; the failures come back keyed by the original rename.
	 */
	private rollBack(
		actions: readonly DelimiterRenameAction[],
	): Effect.Effect<readonly DelimiterActionFailure[]> {
		const inverses = actions.map(invert);
		return Effect.exit(this.vam.dispatch(inverses)).pipe(
			Effect.map((exit) => {
				if (Exit.isSuccess(exit)) return [];
				return correlateFailures(
					inverses,
					failureFromCause(exit.cause),
				).map((failure) => {
					const index = failure.action
						? inverses.indexOf(failure.action)
						: -1;
					const original = index >= 0 ? actions[index] : undefined;
					return Object.freeze({
						...failure,
						action: original,
					});
				});
			}),
		);
	}
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

function rolledBack(
	failure: DelimiterActionFailure,
	restored: readonly DelimiterRenameAction[],
): DelimiterMigrationExecution {
	return Object.freeze({
		failure,
		kind: "RolledBack" as const,
		rolledBack: Object.freeze([...restored]),
	});
}

function conflictError(
	conflicts: readonly DelimiterRenameConflict[],
): DelimiterRenameConflictError {
	return new DelimiterRenameConflictError({
		conflicts: conflicts.map(({ action, occupiedBy, reason }) => ({
			from: splitPathCodec.format(action.payload.from),
			occupiedBy,
			reason,
			to: splitPathCodec.format(action.payload.to),
		})),
		operation: "planDelimiterMigration.conflicts",
	});
}

function invert(action: DelimiterRenameAction): DelimiterRenameAction {
	return Object.freeze({
		kind: VaultActionKind.RenameMdFile,
		// Same link policy as the forward rename, so the links it rewrote
		// are rewritten back.
		payload: Object.freeze({
			...action.payload,
			from: action.payload.to,
			to: action.payload.from,
		}),
	});
}

function failureFromCause(cause: Cause.Cause<unknown>): unknown {
	const reason = cause.reasons.find(Cause.isFailReason);
	return reason ? reason.error : Cause.squash(cause);
}

/** Failures VAM reports before it executes any action of the batch. */
function failedBeforeExecution(failure: unknown): boolean {
	return (
		failure instanceof VamPlanningError ||
		failure instanceof VamDispatchOverflowError ||
		failure instanceof VamShutdownError ||
		failure instanceof VamSetupError
	);
}

/**
 * The planned renames that may have moved a note: the ones VAM executed and
 * the one that failed, which can fail after Obsidian renamed the file. An
 * unrecognised failure leaves every planned rename in doubt.
 */
function possiblyRenamed(
	actions: readonly DelimiterRenameAction[],
	failure: unknown,
): readonly DelimiterRenameAction[] {
	if (failedBeforeExecution(failure)) return [];
	if (!(failure instanceof VamDispatchStoppedError)) return actions;
	const reported = [...failure.executed, failure.failure.action];
	return actions.filter((action) =>
		reported.some((candidate) => sameRename(candidate, action)),
	);
}

function describeDispatchFailure(
	actions: readonly DelimiterRenameAction[],
	failure: unknown,
): DelimiterActionFailure {
	if (
		failure instanceof VamDispatchStoppedError &&
		failure.failure.operation !== "registerSelfEvents"
	) {
		const action = actions.find((candidate) =>
			sameRename(failure.failure.action, candidate),
		);
		if (action) return describeFailure(action, failure.failure);
	}
	const inner =
		failure instanceof VamDispatchStoppedError ? failure.failure : failure;
	return Object.freeze({
		cause: Predicate.hasProperty(inner, "cause") ? inner.cause : inner,
		operation: operationOf(inner),
	});
}

function sameRename(
	candidate: unknown,
	action: DelimiterRenameAction,
): boolean {
	if (candidate === action) return true;
	if (
		!Predicate.hasProperty(candidate, "kind") ||
		candidate.kind !== VaultActionKind.RenameMdFile ||
		!Predicate.hasProperty(candidate, "payload")
	) {
		return false;
	}
	const { payload } = candidate as DelimiterRenameAction;
	return (
		splitPathCodec.format(payload.from) ===
			splitPathCodec.format(action.payload.from) &&
		splitPathCodec.format(payload.to) ===
			splitPathCodec.format(action.payload.to)
	);
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
	return actions.find((candidate) => sameRename(action, candidate));
}

function operationOf(failure: unknown): string {
	return Predicate.hasProperty(failure, "operation") &&
		Predicate.isString(failure.operation)
		? failure.operation
		: "dispatch";
}

function describeFailure(
	action: DelimiterRenameAction,
	failure: unknown,
): DelimiterActionFailure {
	const cause = Predicate.hasProperty(failure, "cause")
		? failure.cause
		: failure;

	return Object.freeze({
		action,
		cause,
		operation: operationOf(failure),
		path: `${splitPathCodec.format(action.payload.from)} → ${splitPathCodec.format(action.payload.to)}`,
	});
}
