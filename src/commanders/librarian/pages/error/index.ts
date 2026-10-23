/**
 * Error types for the split-to-pages action.
 */

import { formatError } from "@textfresser/vault-action-manager/issue-handlers";
import { Data, Effect } from "effect";
import type { CommandRecoveryOutcome } from "../../../base-command-error";

// ─── Error Kind Enum ───

const SIMPLE_SPLIT_ERROR_KINDS = [
	"NoPwd",
	"NoContent",
	"ParseFailed",
	"IntentionFailed",
	"LibrarianUnavailable",
] as const;

class SplitToPagesInputError extends Data.TaggedError(
	"SplitToPagesInputError",
)<{
	readonly kind: (typeof SIMPLE_SPLIT_ERROR_KINDS)[number];
	readonly reason: string;
}> {}

class SplitToPagesDispatchError extends Data.TaggedError(
	"SplitToPagesDispatchError",
)<{
	readonly execution: "FailedBeforeExecution" | "ExecutionUncertain";
	readonly kind: "DispatchFailed";
	readonly operationId: string;
	readonly phase: "InitialVaultDispatch";
	readonly reason: string;
	readonly recovery: CommandRecoveryOutcome;
}> {}

class SplitToPagesReconciliationError extends Data.TaggedError(
	"SplitToPagesReconciliationError",
)<{
	readonly kind: "ReconciliationFailed";
	readonly operationId: string;
	readonly phase: "SemanticReconciliation";
	readonly reason: string;
	readonly reconciliationId: string;
	readonly recovery: CommandRecoveryOutcome;
	readonly status: "Failed" | "PartialFailure";
}> {}

class SplitToPagesNavigationError extends Data.TaggedError(
	"SplitToPagesNavigationError",
)<{
	readonly kind: "NavigationFailed";
	readonly operationId: string;
	readonly phase: "Navigation";
	readonly reason: string;
}> {}

// ─── Error Type ───

export type SplitToPagesError =
	| SplitToPagesInputError
	| SplitToPagesDispatchError
	| SplitToPagesReconciliationError
	| SplitToPagesNavigationError;

// ─── Error Constructors ───

export const makeSplitToPagesError = {
	dispatchFailed: (
		reason: string,
		operationId: string,
		execution: "FailedBeforeExecution" | "ExecutionUncertain",
		recovery: CommandRecoveryOutcome,
	): SplitToPagesError =>
		new SplitToPagesDispatchError({
			execution,
			kind: "DispatchFailed",
			operationId,
			phase: "InitialVaultDispatch",
			reason,
			recovery,
		}),
	intentionFailed: (reason: string): SplitToPagesError =>
		new SplitToPagesInputError({
			kind: "IntentionFailed",
			reason,
		}),
	librarianUnavailable: (reason: string): SplitToPagesError =>
		new SplitToPagesInputError({
			kind: "LibrarianUnavailable",
			reason,
		}),
	navigationFailed: (
		reason: string,
		operationId: string,
	): SplitToPagesError =>
		new SplitToPagesNavigationError({
			kind: "NavigationFailed",
			operationId,
			phase: "Navigation",
			reason,
		}),
	noContent: (reason: string): SplitToPagesError =>
		new SplitToPagesInputError({
			kind: "NoContent",
			reason,
		}),
	noPwd: (reason: string): SplitToPagesError =>
		new SplitToPagesInputError({
			kind: "NoPwd",
			reason,
		}),
	parseFailed: (reason: string): SplitToPagesError =>
		new SplitToPagesInputError({
			kind: "ParseFailed",
			reason,
		}),
	reconciliationFailed: (input: {
		operationId: string;
		reason: string;
		reconciliationId: string;
		recovery: CommandRecoveryOutcome;
		status: "Failed" | "PartialFailure";
	}): SplitToPagesError =>
		new SplitToPagesReconciliationError({
			kind: "ReconciliationFailed",
			operationId: input.operationId,
			phase: "SemanticReconciliation",
			reason: input.reason,
			reconciliationId: input.reconciliationId,
			recovery: input.recovery,
			status: input.status,
		}),
};

// ─── Error Messages ───

const ERROR_MESSAGES: Record<SplitToPagesError["kind"], string> = {
	DispatchFailed: "Failed to split file into pages",
	IntentionFailed: "Failed to plan page split",
	LibrarianUnavailable: "Library is unavailable",
	NavigationFailed: "Split completed but navigation failed",
	NoContent: "Failed to read file content",
	NoPwd: "Failed to get current file",
	ParseFailed: "Failed to parse file name",
	ReconciliationFailed: "Failed to reconcile split pages",
};

// ─── Error Handler ───

/**
 * Shows and logs the error, then tells the user what failed, each through
 * `notify`.
 */
export const handleSplitToPagesError =
	(notify: (message: string) => void) =>
	(error: SplitToPagesError): Effect.Effect<void> => {
		const message = formatError({
			description: `${error.kind}: ${error.reason}`,
			location: "splitToPagesAction",
		});
		return Effect.sync(() => notify(message)).pipe(
			Effect.andThen(Effect.logError(message)),
			Effect.andThen(
				Effect.sync(() => notify(ERROR_MESSAGES[error.kind])),
			),
		);
	};
