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
	},
) {}

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
	| VamScanError
	| VamVaultIoError
	| VamPlanningError
	| VamDispatchError
	| VamSubscriptionError
	| VamShutdownError;
