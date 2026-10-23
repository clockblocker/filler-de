export const BASE_COMMAND_ERROR_KIND_STR = [
	"NotMdFile",
	"NotEligible",
	"DispatchFailed",
	"NoSelection",
] as const;

export type CommandRecoveryOutcome =
	| { readonly kind: "NotNeeded" }
	| { readonly kind: "StagedStateDiscarded" }
	| { readonly kind: "Resynchronized" }
	| { readonly cause: unknown; readonly kind: "Failed" };

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
