import { Cause, Data } from "effect";
import { formatCause } from "../diagnostics/format-cause";
import { displayPath } from "../errors";
import { getErrorMessage } from "../internal/get-error-message";
import { splitPathCodec } from "../split-path-codec";
import type { VaultAction } from "../types/vault-action";
import type { VamDispatchFailure } from "./dispatch-report";

/**
 * The path an action names, as messages show it: `from → to` for a rename.
 */
export function describeVaultActionPath(action: VaultAction): string {
	switch (action.kind) {
		case "RenameFolder":
		case "RenameFile":
		case "RenameMdFile":
			return `${displayPath(splitPathCodec.format(action.payload.from))} → ${displayPath(splitPathCodec.format(action.payload.to))}`;
		default:
			return displayPath(splitPathCodec.format(action.payload.splitPath));
	}
}

/**
 * The message of a VAM error: its operation, the path it touched, and its
 * cause's message. The errors carry no message field of their own, so
 * without this a notice built from one ends blank.
 */
function describeFailure(
	operation: string,
	path: string | undefined,
	cause: unknown,
): string {
	const where = path === undefined ? "" : ` ${displayPath(path)}`;
	const because = cause === undefined ? "" : getErrorMessage(cause);
	return because
		? `${operation}${where}: ${because}`
		: `${operation}${where}`;
}

/**
 * Building the Vault Action Manager failed. `cause` is what the failed
 * step threw, or the build's whole `Cause` when it failed some other way.
 */
export class VamSetupError extends Data.TaggedError("VamSetupError")<{
	readonly cause: unknown;
	readonly operation: string;
}> {
	override get message(): string {
		return describeFailure(
			this.operation,
			undefined,
			Cause.isCause(this.cause)
				? formatCause(this.cause, { stack: false })
				: this.cause,
		);
	}
}

export class VamVaultIoError extends Data.TaggedError("VamVaultIoError")<{
	readonly cause: unknown;
	readonly operation: string;
	readonly path?: string | undefined;
	readonly stateChanged?: boolean | undefined;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export type VamActiveEditorFailureReason =
	| "AdapterFailure"
	| "DomFailure"
	| "IdentityMismatch"
	| "MissingFile"
	| "NavigationFailure"
	| "PathFailure"
	| "ReadFailure"
	| "ReadinessTimeout"
	| "StaleFile"
	| "WriteFailure"
	| "WrongMode";

export class VamActiveEditorError extends Data.TaggedError(
	"VamActiveEditorError",
)<{
	readonly cause: unknown;
	readonly operation: string;
	readonly path?: string | undefined;
	readonly reason: VamActiveEditorFailureReason;
	readonly stateChanged?: boolean | undefined;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

/** Expected absence, kept separate from operational active-editor failures. */
export class VamNoActiveEditorError extends Data.TaggedError(
	"VamNoActiveEditorError",
)<{
	readonly cause: unknown;
	readonly operation: string;
	readonly stateChanged?: boolean | undefined;
}> {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/**
 * A Markdown write found other content than it may write over, and wrote
 * nothing: an asynchronous transform lost a race with a newer edit, a
 * `ProcessMdFile` did not receive its `expected` content, or a
 * `TrashMdFile` found other content than its `ifContent`. A read or write
 * also fails with it when the file's open views hold different content
 * (`OpenViewsDisagree`), so VAM cannot tell which is current.
 */
export class VamContentConflictError extends Data.TaggedError(
	"VamContentConflictError",
)<{
	readonly cause: unknown;
	readonly operation: string;
	readonly path: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

/**
 * An action's target was already taken, so it wrote nothing: a create found
 * a file there, or a rename with `onCollision: "fail"` found its target
 * occupied. `occupiedBy` is the path that holds it, which differs from
 * `path` in case alone where the vault's file system ignores case.
 */
export class VamTargetExistsError extends Data.TaggedError(
	"VamTargetExistsError",
)<{
	readonly cause: unknown;
	readonly occupiedBy: string;
	readonly operation: string;
	readonly path: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export type VamFileAccessError =
	| VamActiveEditorError
	| VamNoActiveEditorError
	| VamVaultIoError;

/**
 * Failures of a content read, which may also find the file's open views
 * holding different content (`VamContentConflictError`).
 */
export type VamFileReadError = VamFileAccessError | VamContentConflictError;

/**
 * Failures of a write, which may also lose a content race or find its
 * target taken.
 */
export type VamFileWriteError =
	| VamFileAccessError
	| VamContentConflictError
	| VamTargetExistsError;

export class VamScanError extends Data.TaggedError("VamScanError")<{
	readonly cause: unknown;
	readonly operation: "scanRoot" | "scanFolder" | "scanFile";
	readonly path: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export class VamPlanningError extends Data.TaggedError("VamPlanningError")<{
	readonly action?: VaultAction | undefined;
	readonly cause: unknown;
	readonly operation: string;
	readonly path?: string | undefined;
}> {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

/**
 * How one action of a Dispatch Batch failed:
 *
 * - `conflict`: its target changed under it, a background content race, a
 *   content precondition that did not hold, or an active editor that moved
 *   on. The action wrote nothing.
 * - `exists`: its target was already taken. The action wrote nothing.
 * - `missing`: its file or folder was not there. The action wrote nothing.
 * - `io`: vault or editor I/O failed. The action may have changed the vault.
 * - `defect`: it threw unexpectedly. It may have changed the vault.
 * - `interrupted`: it was interrupted while it ran. It may have changed the
 *   vault.
 */
export type VamActionFailureKind =
	| "conflict"
	| "exists"
	| "missing"
	| "io"
	| "defect"
	| "interrupted";

/**
 * What a failed fiber's `cause` holds, kept whole: the error or defect of
 * its one reason, or the whole `Cause` when it holds more than one, such as
 * a defect and a finalizer's defect, so none is dropped.
 */
export function causeValue(cause: Cause.Cause<unknown>): unknown {
	const [only, ...others] = cause.reasons;
	if (only === undefined || others.length > 0) return cause;
	if (Cause.isFailReason(only)) return only.error;
	if (Cause.isDieReason(only)) return only.defect;
	return cause;
}

/**
 * One failed action of a Dispatch Batch, with the error that failed it.
 * `cause` is what failed it: for a `defect` or an `interrupted` action,
 * `causeValue` of what ended it, the thrown value or the whole `Cause`; for
 * an action whose own failure came with other reasons, such as a
 * finalizer's defect, the whole `Cause`; for a batch interrupted while it
 * ran, the `VamShutdownError`. `formatCause` prints a `Cause`.
 */
export class VamDispatchError extends Data.TaggedError("VamDispatchError")<{
	readonly action: VaultAction;
	readonly cause: unknown;
	readonly kind: VamActionFailureKind;
	readonly operation: string;
}> {
	override get message(): string {
		const because = Cause.isCause(this.cause)
			? formatCause(this.cause, { stack: false })
			: getErrorMessage(this.cause);
		const what = `${this.action.kind} ${describeVaultActionPath(this.action)}`;
		return because ? `${what}: ${because}` : what;
	}
}

/**
 * A submitted batch found the Dispatch Batch queue at its ceiling. VAM waits
 * for queue space below the ceiling; reaching it signals a runaway producer.
 */
export class VamDispatchOverflowError extends Data.TaggedError(
	"VamDispatchOverflowError",
)<{
	readonly action?: VaultAction | undefined;
	readonly cause: unknown;
	readonly limit: number;
	readonly operation: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/**
 * A Dispatch Batch named a protected path, so VAM refused the whole batch
 * before running any of it. `relation` tells whether the path lies inside a
 * protected prefix or is a folder containing one.
 */
export class VamProtectedPathError extends Data.TaggedError(
	"VamProtectedPathError",
)<{
	readonly action: VaultAction;
	readonly operation: string;
	readonly path: string;
	readonly prefix: string;
	readonly relation: "inside" | "contains";
}> {
	override get message(): string {
		const where =
			this.relation === "inside"
				? `is protected (under "${this.prefix}")`
				: `contains the protected path "${this.prefix}"`;
		return `${this.operation} ${displayPath(this.path)}: refused, the path ${where}; no action in the batch ran`;
	}
}

export class VamSubscriptionError extends Data.TaggedError(
	"VamSubscriptionError",
)<{
	readonly cause: unknown;
	readonly operation: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

export class VamShutdownError extends Data.TaggedError("VamShutdownError")<{
	readonly cause: unknown;
	readonly operation: string;
}> {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/** Why a Dispatch Batch failed: its first failed action, or what kept it from running. */
export type VamDispatchFailureReason =
	| VamPlanningError
	| VamProtectedPathError
	| VamDispatchOverflowError
	| VamShutdownError
	| VamSetupError
	| VamDispatchError;

export type VamEffectError =
	| VamSetupError
	| VamActiveEditorError
	| VamNoActiveEditorError
	| VamScanError
	| VamVaultIoError
	| VamContentConflictError
	| VamTargetExistsError
	| VamPlanningError
	| VamDispatchError
	| VamDispatchFailure
	| VamDispatchOverflowError
	| VamProtectedPathError
	| VamSubscriptionError
	| VamShutdownError;
