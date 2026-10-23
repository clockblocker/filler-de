import type {
	DispatchOrUndoOptions,
	SplitPathToFolder,
	SplitPathToMdFile,
	VamUndoReport,
	VaultAction,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import {
	splitPathCodec,
	VamDispatchError,
	VamDispatchFailure,
	VaultActionKind,
	VaultPath,
} from "@textfresser/vault-action-manager";
import { type Cause, Data, Effect, Exit, Predicate } from "effect";
import type { SuffixDelimiterConfig } from "../../../types";
import { causeValues } from "../../../utils/causes";
import {
	type DelimiterMigrationPlan,
	type DelimiterRenameAction,
	type DelimiterRenameConflict,
	findDelimiterRenameConflicts,
	planDelimiterMigration,
} from "./delimiter-migration-plan";

export type DelimiterMigrationVam = {
	readonly dispatchOrUndo: (
		actions: readonly VaultAction[],
		options: DispatchOrUndoOptions,
	) => ReturnType<VaultActionManager["dispatchOrUndo"]>;
	readonly exists: (
		path: SplitPathToMdFile,
	) => ReturnType<VaultActionManager["exists"]>;
	readonly scan: (
		root: SplitPathToFolder,
	) => ReturnType<VaultActionManager["scan"]>;
	/** Path identity on the vault's file system, for name collisions. */
	readonly paths: VaultActionManager["paths"];
};

/** What renaming the planned notes through `dispatchOrUndo` fails with. */
export type DelimiterDispatchFailure = Effect.Error<
	ReturnType<DelimiterMigrationVam["dispatchOrUndo"]>
>;

export type DelimiterActionFailure = {
	/** The planned rename concerned; absent when the batch failed as a whole. */
	readonly action?: DelimiterRenameAction;
	/** What failed it, as VAM reported it: an error the vault threw. */
	readonly cause: unknown;
	readonly operation: string;
	/** `from → to` of the rename that was attempted. */
	readonly path?: string;
};

/**
 * The failure that stopped a migration's renames, described as one rename's,
 * with the dispatch's whole cause: every failure and defect beside it.
 */
export type DelimiterExecutionFailure = DelimiterActionFailure & {
	readonly dispatch: Cause.Cause<DelimiterDispatchFailure>;
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
			readonly failure: DelimiterExecutionFailure;
			readonly kind: "RolledBack";
			/** Renames that had succeeded and were renamed back. */
			readonly rolledBack: readonly DelimiterRenameAction[];
	  }
	| {
			readonly failure: DelimiterExecutionFailure;
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
export class DelimiterRenameConflictError extends Data.TaggedError(
	"DelimiterRenameConflictError",
)<{
	readonly conflicts: readonly {
		readonly from: string;
		readonly occupiedBy: string;
		readonly reason: "SharedTarget" | "TargetTaken";
		readonly to: string;
	}[];
	readonly operation: string;
}> {
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

/**
 * Where a moved note ended up: back under its old name, still under its new
 * one, or under neither or both. Its renames, forward and back, fail rather
 * than land on a taken name, so a note is never anywhere else. A note not
 * moved at all has no placement.
 */
type Placement = "Restored" | "Moved" | "Unresolved";

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
			this.vam.paths,
		);
		if (conflicts.length > 0) {
			return yield* conflictError(conflicts);
		}
		return plan;
	});

	/**
	 * Renames the planned notes through VAM's `dispatchOrUndo`: the batch
	 * stops at the first failure, and VAM renames every note it moved back,
	 * each only while it still sits under its new name and its old one is
	 * free, so the vault keeps the old delimiter throughout. The undo report
	 * says which notes came back; the vault is probed only for those it
	 * could not bring back, to tell left renamed from unresolved.
	 */
	readonly execute = Effect.fn("DelimiterChangeService.execute")(function* (
		this: DelimiterChangeService,
		plan: DelimiterMigrationPlan,
	) {
		if (plan.actions.length === 0) {
			return completed([]);
		}

		const exit = yield* Effect.exit(
			this.vam.dispatchOrUndo(plan.actions, { caller: "librarian" }),
		);
		if (Exit.isSuccess(exit)) return completed(plan.actions);

		// VAM's typed failure tells whether it renamed back, and how far;
		// without one, the vault is probed. Other reasons are kept for the
		// report.
		const dispatchFailure = causeValues(exit.cause).find(
			(value) => value instanceof VamDispatchFailure,
		);
		const failure = describeDispatchFailure(
			plan.actions,
			exit.cause,
			dispatchFailure,
		);
		const undo = dispatchFailure?.report.undo;
		const settled = undo
			? yield* this.placeAfterUndo(plan.actions, undo)
			: yield* this.placeByProbing(plan.actions);

		const restored = plan.actions.filter(
			(action) => settled.placements.get(action) === "Restored",
		);
		const leftRenamed = plan.actions.filter(
			(action) => settled.placements.get(action) === "Moved",
		);
		const unresolved = plan.actions.filter(
			(action) => settled.placements.get(action) === "Unresolved",
		);
		if (leftRenamed.length === 0 && unresolved.length === 0) {
			return rolledBack(failure, restored);
		}

		return Object.freeze({
			failure,
			kind: "RollbackIncomplete" as const,
			leftRenamed: Object.freeze(leftRenamed),
			rollbackFailures: Object.freeze(
				settled.failures.filter(
					({ action }) => action && !restored.includes(action),
				),
			),
			rolledBack: Object.freeze(restored),
			unresolved: Object.freeze(unresolved),
		});
	});

	/**
	 * Where each note the batch moved ended up, by VAM's undo report: back
	 * under its old name, or, for one VAM could not bring back, wherever the
	 * vault says. A note VAM could not tell about (`Unknown`) stays
	 * unresolved, and one whose rename back never ran stays moved.
	 */
	private readonly placeAfterUndo = Effect.fnUntraced(function* (
		this: DelimiterChangeService,
		actions: readonly DelimiterRenameAction[],
		undo: VamUndoReport,
	) {
		const placements = new Map<DelimiterRenameAction, Placement>();
		const failures: DelimiterActionFailure[] = [];
		for (const { action: undone } of undo.undone) {
			const action = planned(actions, undone);
			if (action) placements.set(action, "Restored");
		}
		for (const blocked of undo.couldNotUndo) {
			const action = planned(actions, blocked.action);
			if (!action) continue;
			if (blocked.error)
				failures.push(describeFailure(action, blocked.error));
			const placement =
				blocked.block === "Unknown"
					? ("Unresolved" as const)
					: blocked.block === "NotRun"
						? ("Moved" as const)
						: yield* this.probe(action);
			placements.set(
				action,
				placement === "Old" ? "Restored" : placement,
			);
		}
		return { failures, placements };
	});

	/**
	 * Where every planned note sits, read from the vault, for a dispatch
	 * that answered no undo report: nothing was renamed back.
	 */
	private readonly placeByProbing = Effect.fnUntraced(function* (
		this: DelimiterChangeService,
		actions: readonly DelimiterRenameAction[],
	) {
		const placements = new Map<DelimiterRenameAction, Placement>();
		for (const action of actions) {
			const placement = yield* this.probe(action);
			if (placement !== "Old") placements.set(action, placement);
		}
		return { failures: [] as DelimiterActionFailure[], placements };
	});

	/** Where a note sits now, between its old and its new name; read from the vault. */
	private probe(
		action: DelimiterRenameAction,
	): Effect.Effect<"Old" | "Moved" | "Unresolved"> {
		return Effect.all([
			this.vam.exists(action.payload.from),
			this.vam.exists(action.payload.to),
		]).pipe(
			Effect.map(([atOld, atNew]) => {
				if (atOld && !atNew) return "Old" as const;
				if (atNew && !atOld) return "Moved" as const;
				return "Unresolved" as const;
			}),
			Effect.catchCause(() => Effect.succeed("Unresolved" as const)),
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
	failure: DelimiterExecutionFailure,
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

/** The planned rename a report names, matched by path: VAM plans its own copies. */
function planned(
	actions: readonly DelimiterRenameAction[],
	reported: VaultAction,
): DelimiterRenameAction | undefined {
	return actions.find((action) => sameRename(reported, action));
}

/** One path, as Obsidian's lookup tells: a case-only rename is a move. */
function samePath(a: SplitPathToMdFile, b: SplitPathToMdFile): boolean {
	return VaultPath.caseSensitive.same(
		splitPathCodec.format(a),
		splitPathCodec.format(b),
	);
}

function sameRename(
	candidate: VaultAction,
	action: DelimiterRenameAction,
): boolean {
	return (
		candidate.kind === VaultActionKind.RenameMdFile &&
		samePath(candidate.payload.from, action.payload.from) &&
		samePath(candidate.payload.to, action.payload.to)
	);
}

/**
 * The rename VAM's typed `failure` names, or the batch as a whole, when it
 * names none or there is none: then the first failure or defect of `cause`
 * is described. The whole `cause` is kept either way.
 */
function describeDispatchFailure(
	actions: readonly DelimiterRenameAction[],
	cause: Cause.Cause<DelimiterDispatchFailure>,
	failure: VamDispatchFailure | undefined,
): DelimiterExecutionFailure {
	if (failure && failure.reason instanceof VamDispatchError) {
		const { reason } = failure;
		const action = actions.find((candidate) =>
			sameRename(reason.action, candidate),
		);
		if (action)
			return Object.freeze({
				...describeFailure(action, reason),
				dispatch: cause,
			});
	}
	const inner = failure ? failure.reason : causeValues(cause)[0];
	return Object.freeze({
		cause: Predicate.hasProperty(inner, "cause") ? inner.cause : inner,
		dispatch: cause,
		operation: operationOf(inner),
	});
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
