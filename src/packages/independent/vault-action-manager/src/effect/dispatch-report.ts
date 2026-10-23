import { Cause, Data } from "effect";
import type { VamOperation } from "../types/event-origin";
import type { AnySplitPath } from "../types/split-path";
import { type VaultAction, VaultActionKind } from "../types/vault-action";
import {
	type VamActionFailureKind,
	VamActiveEditorError,
	VamContentConflictError,
	VamDispatchError,
	type VamDispatchFailureReason,
	VamNoActiveEditorError,
	type VamSetupError,
	type VamShutdownError,
	VamTargetExistsError,
	VamVaultIoError,
} from "./errors";
import type { VamUndoReport } from "./undo-report";

export type { VamDispatchFailureReason } from "./errors";

/**
 * What one completed action did to the vault. Hashes are
 * `vaultContentHash`es of the whole file.
 *
 * - `Created`: made the file or folder; a file's `contentHash` is what it
 *   was created with.
 * - `Wrote`: changed an existing file's content from `beforeHash` to
 *   `afterHash`.
 * - `Renamed`: moved the source to `to`.
 * - `RenamedToIndexed`: the target was taken, so the source moved to the
 *   free indexed path `to` instead.
 * - `TrashedDuplicate`: the target already held the source's content, so
 *   the source went to the trash.
 * - `Trashed`: moved the target to the trash.
 * - `NoOp`: changed nothing: the folder or file was already there, the
 *   transform kept the content, the upsert's content was already there, the
 *   file to trash was gone, or a rename's source was gone and its target
 *   there.
 */
export type VamActionOutcome =
	| {
			readonly _tag: "Created";
			readonly contentHash?: string | undefined;
	  }
	| {
			readonly _tag: "Wrote";
			readonly afterHash: string;
			readonly beforeHash: string;
	  }
	| { readonly _tag: "Renamed"; readonly to: AnySplitPath }
	| { readonly _tag: "RenamedToIndexed"; readonly to: AnySplitPath }
	| { readonly _tag: "TrashedDuplicate" }
	| { readonly _tag: "Trashed" }
	| { readonly _tag: "NoOp" };

/**
 * One planned action of a Dispatch Batch and what became of it:
 *
 * - `Done`: it completed, with its `outcome`.
 * - `Failed`: it failed and changed nothing (`conflict`, `exists` or
 *   `missing`).
 * - `Uncertain`: it failed and may have changed the vault, such as a rename
 *   that moved the file and then could not restore the editor selection.
 *   For a create or a rename, `targetTaken` says whether something held
 *   its target (a rename's `to`), as the vault's file system compares
 *   names, by the collision check the action made immediately before it
 *   wrote or moved; it is absent when the action failed before that check.
 * - `Skipped`: it never ran.
 */
export type VamDispatchEntry =
	| {
			readonly action: VaultAction;
			readonly outcome: VamActionOutcome;
			readonly status: "Done";
	  }
	| {
			readonly action: VaultAction;
			readonly error: VamDispatchError;
			readonly status: "Failed";
	  }
	| {
			readonly action: VaultAction;
			readonly error: VamDispatchError;
			readonly status: "Uncertain";
			readonly targetTaken?: boolean | undefined;
	  }
	| { readonly action: VaultAction; readonly status: "Skipped" };

/**
 * Whether a Dispatch Batch changed the vault: `yes` when a completed action
 * changed something, `unknown` when none did but a failed one may have,
 * `no` otherwise.
 */
export type VamTouchedVault = "no" | "yes" | "unknown";

type VamDispatchReportFields = {
	readonly caller: string;
	readonly entries: readonly VamDispatchEntry[];
	readonly operationId: string;
	readonly undo?: VamUndoReport | undefined;
};

/**
 * The receipt of one Dispatch Batch: one entry per planned action, in the
 * order VAM ran them. Planned actions include prerequisites VAM added, such
 * as parent folders. A batch that failed before planning, because it was
 * refused, overflowed, or met a shut-down VAM, lists each submitted action
 * as `Skipped`. `caller` and `operationId` name the batch, as its spans and
 * the origins of its events do. `undo` says what `dispatchOrUndo` took
 * back after a failure; other dispatches never set it.
 */
export class VamDispatchReport extends Data.Class<VamDispatchReportFields> {
	/**
	 * Holds its own copy of `entries`, and its fields in the order above,
	 * whatever the caller's, as `formatCause` prints them.
	 */
	constructor(fields: VamDispatchReportFields) {
		super({
			caller: fields.caller,
			entries: [...fields.entries],
			operationId: fields.operationId,
			...("undo" in fields ? { undo: fields.undo } : {}),
		});
	}

	/** A report for a batch of `operation` none of which ran. */
	static notRun(
		actions: readonly VaultAction[],
		operation: VamOperation,
	): VamDispatchReport {
		return new VamDispatchReport({
			...operation,
			entries: actions.map((action) => ({
				action,
				status: "Skipped" as const,
			})),
		});
	}

	/** The entry for an action that failed with `error`: `Failed` when it changed nothing. */
	static entryFor(error: VamDispatchError): VamDispatchEntry {
		return {
			action: error.action,
			error,
			status: wroteNothing(error.kind) ? "Failed" : "Uncertain",
		};
	}

	/**
	 * `entry` with whether its action's target was taken when its collision
	 * check ran, kept only on an `Uncertain` entry, where a probe needs it.
	 */
	static withTargetTaken(
		entry: VamDispatchEntry,
		targetTaken: boolean | undefined,
	): VamDispatchEntry {
		return entry.status === "Uncertain" && targetTaken !== undefined
			? { ...entry, targetTaken }
			: entry;
	}

	/** Actions that completed, in run order. */
	get executed(): readonly VaultAction[] {
		return this.actionsWith("Done");
	}

	/** Errors of the actions that failed, `Failed` and `Uncertain`, in run order. */
	get failed(): readonly VamDispatchError[] {
		return this.entries.flatMap((entry) =>
			entry.status === "Failed" || entry.status === "Uncertain"
				? [entry.error]
				: [],
		);
	}

	/** Actions that failed and may have changed the vault. */
	get uncertain(): readonly VaultAction[] {
		return this.actionsWith("Uncertain");
	}

	/** Actions that never ran. */
	get skipped(): readonly VaultAction[] {
		return this.actionsWith("Skipped");
	}

	get touchedVault(): VamTouchedVault {
		if (
			this.entries.some(
				(entry) =>
					entry.status === "Done" && entry.outcome._tag !== "NoOp",
			)
		)
			return "yes";
		return this.entries.some((entry) => entry.status === "Uncertain")
			? "unknown"
			: "no";
	}

	private actionsWith(
		status: VamDispatchEntry["status"],
	): readonly VaultAction[] {
		return this.entries.flatMap((entry) =>
			entry.status === status ? [entry.action] : [],
		);
	}
}

/**
 * The one failure of `dispatch`, `dispatchStopOnFirstFailure` and
 * `dispatchWithReport`. `reason` tells why the batch failed: its first
 * failed action's `VamDispatchError`, or an error that kept the batch from
 * running at all. `report` tells what each planned action did.
 */
export class VamDispatchFailure extends Data.TaggedError("VamDispatchFailure")<{
	readonly reason: VamDispatchFailureReason;
	readonly report: VamDispatchReport;
}> {
	/** A batch of `operation` that failed before any of it ran. */
	static notRun(
		reason: Exclude<VamDispatchFailureReason, VamDispatchError>,
		actions: readonly VaultAction[],
		operation: VamOperation,
	): VamDispatchFailure {
		return new VamDispatchFailure({
			reason,
			report: VamDispatchReport.notRun(actions, operation),
		});
	}

	/** A batch in which actions failed; `undefined` when none did. */
	static ofReport(report: VamDispatchReport): VamDispatchFailure | undefined {
		const [first] = report.failed;
		return first
			? new VamDispatchFailure({ reason: first, report })
			: undefined;
	}

	override get message(): string {
		if (!(this.reason instanceof VamDispatchError))
			return this.reason.message;
		const failed = this.report.failed.map((error) => error.message);
		const skipped = this.report.skipped.length;
		return skipped > 0
			? `${failed.join("; ")}; ${skipped} later action(s) skipped`
			: failed.join("; ");
	}
}

/**
 * A dispatch's `cause` with each `VamSetupError` or `VamShutdownError` that
 * kept the batch from running turned into a `VamDispatchFailure` of
 * `operation` that ran none of `actions`, where it stood. Every other
 * failure and defect stays where it stood, so `Effect.catch` and `catchTag`
 * still get the `notRun` failure first while a defect beside it is kept.
 * Interruptions beside such a failure are left out, as `dispatchOrUndo`
 * leaves them out: they say who stopped a fiber, not why it failed. A
 * cause with neither error passes on whole.
 */
export function notRunCause(
	cause: Cause.Cause<VamDispatchFailure | VamSetupError | VamShutdownError>,
	actions: readonly VaultAction[],
	operation: VamOperation,
): Cause.Cause<VamDispatchFailure> {
	const failures = Cause.map(cause, (error) =>
		keptFromRunning(error)
			? VamDispatchFailure.notRun(error, actions, operation)
			: error,
	);
	const notRun = cause.reasons.some(
		(reason) => Cause.isFailReason(reason) && keptFromRunning(reason.error),
	);
	return notRun
		? Cause.fromReasons(
				failures.reasons.filter(
					(reason) => !Cause.isInterruptReason(reason),
				),
			)
		: failures;
}

function keptFromRunning(
	error: VamDispatchFailure | VamSetupError | VamShutdownError,
): error is VamSetupError | VamShutdownError {
	return error._tag === "VamSetupError" || error._tag === "VamShutdownError";
}

/**
 * Whether the batch failed only because files changed under its actions,
 * so they wrote nothing and may succeed when run again on fresh content.
 */
export function isContentConflict(failure: VamDispatchFailure): boolean {
	const { failed } = failure.report;
	return (
		failed.length > 0 && failed.every((error) => error.kind === "conflict")
	);
}

/** The path a create or a rename puts something at. */
export function actionTarget(action: VaultAction): AnySplitPath | undefined {
	switch (action.kind) {
		case VaultActionKind.CreateFolder:
		case VaultActionKind.CreateFile:
		case VaultActionKind.CreateMdFile:
			return action.payload.splitPath;
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameMdFile:
			return action.payload.to;
		default:
			return undefined;
	}
}

function wroteNothing(kind: VamActionFailureKind): boolean {
	return kind === "conflict" || kind === "exists" || kind === "missing";
}

/** Lookups that fail before an action writes anything. */
const LOOKUP_OPERATIONS: ReadonlySet<string> = new Set([
	"getFile",
	"getFolder",
	"renameFile.resolve",
	"renameFolder.resolve",
]);

/** The kind of an action's failure, from the error its execution raised. */
export function classifyActionFailure(cause: unknown): VamActionFailureKind {
	if (cause instanceof VamContentConflictError) return "conflict";
	if (cause instanceof VamTargetExistsError) return "exists";
	if (cause instanceof VamActiveEditorError) {
		// `WrongMode` is raised before the editor is touched: a view in
		// reading mode holds content not yet saved, so a write cannot go
		// through it now, and may once the save lands.
		return cause.stateChanged !== true &&
			(cause.reason === "IdentityMismatch" ||
				cause.reason === "StaleFile" ||
				cause.reason === "WrongMode")
			? "conflict"
			: "io";
	}
	if (cause instanceof VamVaultIoError) {
		return cause.stateChanged !== true &&
			LOOKUP_OPERATIONS.has(cause.operation)
			? "missing"
			: "io";
	}
	if (cause instanceof VamNoActiveEditorError) return "io";
	return "defect";
}
