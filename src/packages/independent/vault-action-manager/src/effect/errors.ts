import { Schema } from "effect";
import { displayPath } from "../errors";
import { getErrorMessage } from "../internal/get-error-message";
import type { VaultAction } from "../types/vault-action";

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
 * A background Markdown transform lost a race: the file changed while an
 * asynchronous transform was running, so its result was not written.
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

export type VamFileAccessError =
	| VamActiveEditorError
	| VamNoActiveEditorError
	| VamVaultIoError;

/** Failures of a Markdown write, which may also lose a content race. */
export type VamFileWriteError = VamFileAccessError | VamContentConflictError;

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
		action: Schema.optional(Schema.Unknown),
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
	},
) {
	override get message(): string {
		return describeFailure(this.operation, this.path, this.cause);
	}
}

export class VamDispatchError extends Schema.TaggedError<VamDispatchError>()(
	"VamDispatchError",
	{
		action: Schema.optional(Schema.Unknown),
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

const VaultActionListSchema = Schema.declare(
	(input: unknown): input is readonly VaultAction[] => Array.isArray(input),
);

/**
 * A batch dispatched with `stopOnFirstFailure` stopped at its first failed
 * action. `executed` lists the planned actions that completed before it, and
 * `skipped` the planned actions that were never attempted.
 */
export class VamDispatchStoppedError extends Schema.TaggedError<VamDispatchStoppedError>()(
	"VamDispatchStoppedError",
	{
		action: Schema.optional(Schema.Unknown),
		cause: Schema.Defect(),
		executed: VaultActionListSchema,
		failure: Schema.instanceOf(VamDispatchError),
		operation: Schema.String,
		skipped: VaultActionListSchema,
	},
) {
	override get message(): string {
		return describeFailure(this.operation, undefined, this.cause);
	}
}

/**
 * A submitted batch found the Dispatch Batch queue at its ceiling. VAM waits
 * for queue space below the ceiling; reaching it signals a runaway producer.
 */
export class VamDispatchOverflowError extends Schema.TaggedError<VamDispatchOverflowError>()(
	"VamDispatchOverflowError",
	{
		action: Schema.optional(Schema.Unknown),
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
		action: Schema.optional(Schema.Unknown),
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
	| VamPlanningError
	| VamDispatchError
	| VamDispatchStoppedError
	| VamDispatchOverflowError
	| VamProtectedPathError
	| VamSubscriptionError
	| VamShutdownError;
