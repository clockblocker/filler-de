import { Schema } from "effect";
import type { VaultAction } from "../types/vault-action";

export class VamSetupError extends Schema.TaggedError<VamSetupError>()(
	"VamSetupError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {}

export class VamVaultIoError extends Schema.TaggedError<VamVaultIoError>()(
	"VamVaultIoError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
		stateChanged: Schema.optional(Schema.Boolean),
	},
) {}

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
) {}

/** Expected absence, kept separate from operational active-editor failures. */
export class VamNoActiveEditorError extends Schema.TaggedError<VamNoActiveEditorError>()(
	"VamNoActiveEditorError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
		stateChanged: Schema.optional(Schema.Boolean),
	},
) {}

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
) {}

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
) {}

export class VamPlanningError extends Schema.TaggedError<VamPlanningError>()(
	"VamPlanningError",
	{
		action: Schema.optional(Schema.Unknown),
		cause: Schema.Defect(),
		operation: Schema.String,
		path: Schema.optional(Schema.String),
	},
) {}

export class VamDispatchError extends Schema.TaggedError<VamDispatchError>()(
	"VamDispatchError",
	{
		action: Schema.optional(Schema.Unknown),
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {}

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
) {}

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
) {}

export class VamSubscriptionError extends Schema.TaggedError<VamSubscriptionError>()(
	"VamSubscriptionError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {}

export class VamShutdownError extends Schema.TaggedError<VamShutdownError>()(
	"VamShutdownError",
	{
		cause: Schema.Defect(),
		operation: Schema.String,
	},
) {}

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
	| VamSubscriptionError
	| VamShutdownError;
