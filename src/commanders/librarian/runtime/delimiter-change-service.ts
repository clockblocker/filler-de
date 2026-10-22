import type {
	DispatchOptions,
	SplitPathToFolder,
	SplitPathToMdFile,
	VamDispatchEntry,
	VamDispatchReport,
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
	readonly dispatchWithReport: (
		actions: readonly VaultAction[],
		options?: DispatchOptions,
	) => ReturnType<VaultActionManager["dispatchWithReport"]>;
	readonly exists: (
		path: SplitPathToMdFile,
	) => ReturnType<VaultActionManager["exists"]>;
	readonly scan: (
		root: SplitPathToFolder,
	) => ReturnType<VaultActionManager["scan"]>;
	/** Path identity on the vault's file system, for name collisions. */
	readonly paths: VaultActionManager["paths"];
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

/**
 * Where a planned note sits: under its old name, under its new one, or under
 * neither or both. Its renames, forward and back, fail rather than land on a
 * taken name, so a note is never anywhere else.
 */
type Placement = "Old" | "Moved" | "Unresolved";

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
	 * Renames the planned notes, stopping at the first failure. After a
	 * failure, every note the migration moved is renamed back, so the vault
	 * keeps the old delimiter throughout. VAM's dispatch reports say which
	 * notes moved and which came back; the vault is probed only for renames
	 * the reports leave uncertain.
	 */
	readonly execute = Effect.fn("DelimiterChangeService.execute")(function* (
		this: DelimiterChangeService,
		plan: DelimiterMigrationPlan,
	) {
		if (plan.actions.length === 0) {
			return completed([]);
		}

		const exit = yield* Effect.exit(
			this.vam.dispatchWithReport(plan.actions, {
				stopOnFirstFailure: true,
			}),
		);
		if (Exit.isSuccess(exit)) return completed(plan.actions);

		const dispatchFailure = failureFromCause(exit.cause);
		const failure = describeDispatchFailure(plan.actions, dispatchFailure);
		const before = yield* Effect.forEach(plan.actions, (action) =>
			dispatchFailure instanceof VamDispatchFailure
				? this.placeAfterForward(action, dispatchFailure.report)
				: this.probe(action),
		);
		const moved = plan.actions
			.filter((_, index) => before[index] === "Moved")
			.reverse();
		if (moved.length === 0 && !before.includes("Unresolved")) {
			return rolledBack(failure, []);
		}

		const rollback =
			moved.length > 0
				? yield* this.rollBack(moved)
				: {
						failures: [],
						placements: new Map<DelimiterRenameAction, Placement>(),
					};
		const after = plan.actions.map(
			(action, index) =>
				rollback.placements.get(action) ??
				before[index] ??
				"Unresolved",
		);
		const restored = plan.actions.filter(
			(action, index) => after[index] === "Old" && moved.includes(action),
		);
		const leftRenamed = plan.actions.filter(
			(_, index) => after[index] === "Moved",
		);
		const unresolved = plan.actions.filter(
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
				rollback.failures.filter(
					({ action }) => action && !restored.includes(action),
				),
			),
			rolledBack: Object.freeze(restored),
			unresolved: Object.freeze(unresolved),
		});
	});

	/**
	 * Where a forward rename left its note, by the stopped batch's report. A
	 * rename that fails on a taken name moves nothing, so `Done` is the only
	 * report of a move, always to the planned name.
	 */
	private placeAfterForward(
		action: DelimiterRenameAction,
		report: VamDispatchReport,
	): Effect.Effect<Placement> {
		const entry = entryFor(report, action);
		if (!entry) return this.probe(action);
		switch (entry.status) {
			case "Done":
				return Effect.succeed("Moved");
			case "Uncertain":
				return this.probe(action);
			case "Failed":
			case "Skipped":
				return Effect.succeed("Old");
		}
	}

	/** Where a note sits now, between its old and its new name; read from the vault. */
	private probe(action: DelimiterRenameAction): Effect.Effect<Placement> {
		return Effect.all([
			this.vam.exists(action.payload.from),
			this.vam.exists(action.payload.to),
		]).pipe(
			Effect.map(([atOld, atNew]): Placement => {
				if (atOld && !atNew) return "Old";
				if (atNew && !atOld) return "Moved";
				return "Unresolved";
			}),
			Effect.catchCause(() => Effect.succeed("Unresolved" as const)),
		);
	}

	/**
	 * Renames each moved note back to its old name. Every inverse rename is
	 * attempted, and fails rather than land on its old name if another note
	 * took it meanwhile; the report says where each note ended up, and the
	 * failures come back keyed by the original rename.
	 */
	private readonly rollBack = Effect.fnUntraced(function* (
		this: DelimiterChangeService,
		moved: readonly DelimiterRenameAction[],
	): Effect.fn.Return<{
		readonly failures: readonly DelimiterActionFailure[];
		readonly placements: ReadonlyMap<DelimiterRenameAction, Placement>;
	}> {
		const inverses = moved.map(invert);
		const exit = yield* Effect.exit(this.vam.dispatchWithReport(inverses));
		const failure = Exit.isSuccess(exit)
			? undefined
			: failureFromCause(exit.cause);
		const report = Exit.isSuccess(exit)
			? exit.value
			: failure instanceof VamDispatchFailure
				? failure.report
				: undefined;
		const failures: DelimiterActionFailure[] = [];
		const placements = new Map<DelimiterRenameAction, Placement>();
		for (const [index, action] of moved.entries()) {
			const inverse = inverses[index];
			const entry =
				report && inverse ? entryFor(report, inverse) : undefined;
			if (entry?.status === "Done") {
				placements.set(action, "Old");
				continue;
			}
			if (entry?.status === "Failed" || entry?.status === "Uncertain") {
				failures.push(describeFailure(action, entry.error));
			} else if (failure !== undefined) {
				failures.push(
					describeFailure(
						action,
						failure instanceof VamDispatchFailure
							? failure.reason
							: failure,
					),
				);
			}
			// A skipped inverse left the note where it was. A failed one
			// changed nothing, but may have failed because the note is not
			// under its new name any more, so the vault says where it is.
			placements.set(
				action,
				entry?.status === "Skipped"
					? "Moved"
					: yield* this.probe(action),
			);
		}
		return { failures, placements };
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

/** The rename that moves a note from its new name back to its old one. */
function invert(action: DelimiterRenameAction): DelimiterRenameAction {
	return Object.freeze({
		kind: VaultActionKind.RenameMdFile,
		// Same link and collision policies as the forward rename, so the
		// links it rewrote are rewritten back, and a taken old name fails.
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

/** The report's entry for a rename, matched by path: VAM plans its own copies. */
function entryFor(
	report: VamDispatchReport,
	action: DelimiterRenameAction,
): VamDispatchEntry | undefined {
	return report.entries.find((entry) => sameRename(entry.action, action));
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

function describeDispatchFailure(
	actions: readonly DelimiterRenameAction[],
	failure: unknown,
): DelimiterActionFailure {
	if (
		failure instanceof VamDispatchFailure &&
		failure.reason instanceof VamDispatchError
	) {
		const { reason } = failure;
		const action = actions.find((candidate) =>
			sameRename(reason.action, candidate),
		);
		if (action) return describeFailure(action, reason);
	}
	const inner =
		failure instanceof VamDispatchFailure ? failure.reason : failure;
	return Object.freeze({
		cause: Predicate.hasProperty(inner, "cause") ? inner.cause : inner,
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
