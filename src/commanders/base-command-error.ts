export const BASE_COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
	"NoSelection",
] as const;

export type BaseCommandErrorKind = (typeof BASE_COMMAND_ERROR_KIND_STR)[number];

export type BaseCommandError =
	| { kind: "NotMdFile" }
	| { kind: "NotEligible"; reason: string }
	| { kind: "DispatchFailed"; reason: string }
	| { kind: "NoSelection" };
