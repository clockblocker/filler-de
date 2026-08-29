import { Schema } from "effect";

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

export type VamFileAccessError =
	| VamActiveEditorError
	| VamNoActiveEditorError
	| VamVaultIoError;

export class VamScanError extends Schema.TaggedError<VamScanError>()(
	"VamScanError",
	{
		cause: Schema.Defect(),
		operation: Schema.Literals(["scanRoot", "scanFolder"]),
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
	| VamPlanningError
	| VamDispatchError
	| VamSubscriptionError
	| VamShutdownError;
