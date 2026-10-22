import { Predicate, Schema } from "effect";
import type { AnySplitPath } from "../types/split-path";
import type { VaultAction } from "../types/vault-action";
import {
	type VamActionFailureKind,
	VamActiveEditorError,
	VamContentConflictError,
	VamDispatchError,
	VamDispatchOverflowError,
	VamNoActiveEditorError,
	VamPlanningError,
	VamProtectedPathError,
	VamSetupError,
	VamShutdownError,
	VamTargetExistsError,
	VamVaultIoError,
	VaultActionSchema,
} from "./errors";

const SplitPathSchema = Schema.declare(
	(input: unknown): input is AnySplitPath =>
		Predicate.hasProperty(input, "kind") &&
		Predicate.hasProperty(input, "basename") &&
		Predicate.hasProperty(input, "pathParts"),
);

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
export const VamActionOutcomeSchema = Schema.Union([
	Schema.TaggedStruct("Created", {
		contentHash: Schema.optional(Schema.String),
	}),
	Schema.TaggedStruct("Wrote", {
		afterHash: Schema.String,
		beforeHash: Schema.String,
	}),
	Schema.TaggedStruct("Renamed", { to: SplitPathSchema }),
	Schema.TaggedStruct("RenamedToIndexed", { to: SplitPathSchema }),
	Schema.TaggedStruct("TrashedDuplicate", {}),
	Schema.TaggedStruct("Trashed", {}),
	Schema.TaggedStruct("NoOp", {}),
]);

export type VamActionOutcome = typeof VamActionOutcomeSchema.Type;

/**
 * One planned action of a Dispatch Batch and what became of it:
 *
 * - `Done`: it completed, with its `outcome`.
 * - `Failed`: it failed and changed nothing (`conflict`, `exists` or
 *   `missing`).
 * - `Uncertain`: it failed and may have changed the vault, such as a rename
 *   that moved the file and then could not restore the editor selection.
 * - `Skipped`: it never ran.
 */
export const VamDispatchEntrySchema = Schema.Union([
	Schema.Struct({
		action: VaultActionSchema,
		outcome: VamActionOutcomeSchema,
		status: Schema.Literal("Done"),
	}),
	Schema.Struct({
		action: VaultActionSchema,
		error: Schema.instanceOf(VamDispatchError),
		status: Schema.Literal("Failed"),
	}),
	Schema.Struct({
		action: VaultActionSchema,
		error: Schema.instanceOf(VamDispatchError),
		status: Schema.Literal("Uncertain"),
	}),
	Schema.Struct({
		action: VaultActionSchema,
		status: Schema.Literal("Skipped"),
	}),
]);

export type VamDispatchEntry = typeof VamDispatchEntrySchema.Type;

/**
 * Whether a Dispatch Batch changed the vault: `yes` when a completed action
 * changed something, `unknown` when none did but a failed one may have,
 * `no` otherwise.
 */
export type VamTouchedVault = "no" | "yes" | "unknown";

/**
 * The receipt of one Dispatch Batch: one entry per planned action, in the
 * order VAM ran them. Planned actions include prerequisites VAM added, such
 * as parent folders. A batch that failed before planning, because it was
 * refused, overflowed, or met a shut-down VAM, lists each submitted action
 * as `Skipped`.
 */
export class VamDispatchReport extends Schema.Class<VamDispatchReport>(
	"VamDispatchReport",
)({
	entries: Schema.Array(VamDispatchEntrySchema),
}) {
	/** A report for a batch none of which ran. */
	static notRun(actions: readonly VaultAction[]): VamDispatchReport {
		return new VamDispatchReport({
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

/** Why a Dispatch Batch failed. */
export const VamDispatchFailureReasonSchema = Schema.Union([
	VamPlanningError,
	VamProtectedPathError,
	VamDispatchOverflowError,
	VamShutdownError,
	VamSetupError,
	VamDispatchError,
]);

export type VamDispatchFailureReason =
	typeof VamDispatchFailureReasonSchema.Type;

/**
 * The one failure of `dispatch`, `dispatchStopOnFirstFailure` and
 * `dispatchWithReport`. `reason` tells why the batch failed: its first
 * failed action's `VamDispatchError`, or an error that kept the batch from
 * running at all. `report` tells what each planned action did.
 */
export class VamDispatchFailure extends Schema.TaggedError<VamDispatchFailure>()(
	"VamDispatchFailure",
	{
		reason: VamDispatchFailureReasonSchema,
		report: VamDispatchReport,
	},
) {
	/** A batch that failed before any of it ran. */
	static notRun(
		reason: Exclude<VamDispatchFailureReason, VamDispatchError>,
		actions: readonly VaultAction[],
	): VamDispatchFailure {
		return new VamDispatchFailure({
			reason,
			report: VamDispatchReport.notRun(actions),
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
 * Whether the batch failed only because files changed under its actions,
 * so they wrote nothing and may succeed when run again on fresh content.
 */
export function isContentConflict(failure: VamDispatchFailure): boolean {
	const { failed } = failure.report;
	return (
		failed.length > 0 && failed.every((error) => error.kind === "conflict")
	);
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
		return cause.stateChanged !== true &&
			(cause.reason === "IdentityMismatch" ||
				cause.reason === "StaleFile")
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
