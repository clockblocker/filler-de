import { Schema } from "effect";

export const BASE_COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
	"NoSelection",
] as const;

export const CommandRecoveryOutcomeSchema = Schema.Union([
	Schema.Struct({ kind: Schema.Literal("NotNeeded") }),
	Schema.Struct({ kind: Schema.Literal("StagedStateDiscarded") }),
	Schema.Struct({ kind: Schema.Literal("Resynchronized") }),
	Schema.Struct({ cause: Schema.Defect(), kind: Schema.Literal("Failed") }),
]);

export type CommandRecoveryOutcome = typeof CommandRecoveryOutcomeSchema.Type;

export type BaseCommandError =
	| { kind: "NotMdFile" }
	| { kind: "NotEligible"; reason: string }
	| {
			kind: "DispatchFailed";
			reason: string;
			execution?: "FailedBeforeExecution" | "ExecutionUncertain";
			operationId?: string;
			phase?:
				| "InitialVaultDispatch"
				| "SemanticReconciliation"
				| "Navigation";
			reconciliationId?: string;
			recovery?: CommandRecoveryOutcome;
			status?: "Failed" | "PartialFailure";
	  }
	| { kind: "NoSelection" };
