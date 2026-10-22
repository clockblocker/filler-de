import { Predicate, Schema } from "effect";
import { displayPath } from "../errors";
import { getErrorMessage } from "../internal/get-error-message";
import { splitPathCodec } from "../split-path-codec";
import type { VaultAction } from "../types/vault-action";
import type { VamDispatchFailure } from "./dispatch-report";

/** A `VaultAction` field. Actions carry functions, so they are declared, not encoded. */
export const VaultActionSchema = Schema.declare(
	(input: unknown): input is VaultAction =>
		Predicate.hasProperty(input, "kind") &&
		Predicate.isString(input.kind) &&
		Predicate.hasProperty(input, "payload"),
);

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

export class VamSetupError extends Schema.TaggedError<VamSetupError>()(
	"VamSetupError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

export class VamVaultIoError extends Schema.TaggedError<VamVaultIoError>()(
	"VamVaultIoError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
		stateChanged: Schema.optional(Schema.Boolean),
	},
) {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export const VamActiveEditorFailureReasonSchema = Schema.Literals([
	"AdapterFailure",
	"DomFailure",
	"IdentityMismatch",
	"MissingFile",
	"NavigationFailure",
	"PathFailure",
	"ReadFailure",
	"ReadinessTimeout",
	"StaleFile",
	"WriteFailure",
	"WrongMode",
]);

export type VamActiveEditorFailureReason =
	typeof VamActiveEditorFailureReasonSchema.Type;

export class VamActiveEditorError extends Schema.TaggedError<VamActiveEditorError>()(
	"VamActiveEditorError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
		reason: VamActiveEditorFailureReasonSchema,
		stateChanged: Schema.optional(Schema.Boolean),
	},
) {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

/** Expected absence, kept separate from operational active-editor failures. */
export class VamNoActiveEditorError extends Schema.TaggedError<VamNoActiveEditorError>()(
	"VamNoActiveEditorError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		stateChanged: Schema.optional(Schema.Boolean),
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/**
 * A Markdown write found other content than it may write over, and wrote
 * nothing: an asynchronous transform lost a race with a newer edit, a
 * `ProcessMdFile` did not receive its `expected` content, or a
 * `TrashMdFile` found other content than its `ifContent`.
 */
export class VamContentConflictError extends Schema.TaggedError<VamContentConflictError>()(
	"VamContentConflictError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.String,
	},
) {
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
export class VamTargetExistsError extends Schema.TaggedError<VamTargetExistsError>()(
	"VamTargetExistsError",
	{
		cause: Schema.Defect(),
		occupiedBy: Schema.String,
		operation: Schema.String,
		path: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export type VamFileAccessError =
	| VamActiveEditorError
	| VamNoActiveEditorError
	| VamVaultIoError;

/**
 * Failures of a write, which may also lose a content race or find its
 * target taken.
 */
export type VamFileWriteError =
	| VamFileAccessError
	| VamContentConflictError
	| VamTargetExistsError;

export class VamScanError extends Schema.TaggedError<VamScanError>()(
	"VamScanError",
	{
		cause: Schema.Defect(),
		operation: Schema.Literals(["scanRoot", "scanFolder", "scanFile"]),
		path: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export class VamPlanningError extends Schema.TaggedError<VamPlanningError>()(
	"VamPlanningError",
	{
		action: Schema.optional(VaultActionSchema),
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
	},
) {
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
 */
export const VamActionFailureKindSchema = Schema.Literals([
	"conflict",
	"exists",
	"missing",
	"io",
	"defect",
]);

export type VamActionFailureKind = typeof VamActionFailureKindSchema.Type;

/** One failed action of a Dispatch Batch, with the error that failed it. */
export class VamDispatchError extends Schema.TaggedError<VamDispatchError>()(
	"VamDispatchError",
	{
		action: VaultActionSchema,
		cause: Schema.Defect(),
		kind: VamActionFailureKindSchema,
		operation: Schema.String,
	},
) {
	override get message(): string {
		const because = getErrorMessage(this.cause);
		const what = `${this.action.kind} ${describeVaultActionPath(this.action)}`;
		return because ? `${what}: ${because}` : what;
	}
}

/**
 * A submitted batch found the Dispatch Batch queue at its ceiling. VAM waits
 * for queue space below the ceiling; reaching it signals a runaway producer.
 */
export class VamDispatchOverflowError extends Schema.TaggedError<VamDispatchOverflowError>()(
	"VamDispatchOverflowError",
	{
		action: Schema.optional(VaultActionSchema),
		cause: Schema.Defect(),
		limit: Schema.Number,
		operation: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/**
 * A Dispatch Batch named a protected path, so VAM refused the whole batch
 * before running any of it. `relation` tells whether the path lies inside a
 * protected prefix or is a folder containing one.
 */
export class VamProtectedPathError extends Schema.TaggedError<VamProtectedPathError>()(
	"VamProtectedPathError",
	{
		action: VaultActionSchema,
		operation: Schema.String,
		path: Schema.String,
		prefix: Schema.String,
		relation: Schema.Literals(["inside", "contains"]),
	},
) {
	override get message(): string {
		const where =
			this.relation === "inside"
				? `is protected (under "${this.prefix}")`
				: `contains the protected path "${this.prefix}"`;
		return `${this.operation} ${displayPath(this.path)}: refused, the path ${where}; no action in the batch ran`;
	}
}

export class VamSubscriptionError extends Schema.TaggedError<VamSubscriptionError>()(
	"VamSubscriptionError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

export class VamShutdownError extends Schema.TaggedError<VamShutdownError>()(
	"VamShutdownError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

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
