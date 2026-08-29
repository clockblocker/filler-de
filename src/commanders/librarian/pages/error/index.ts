/**
 * Error types for the split-to-pages action.
 */

import { logError } from "@textfresser/vault-action-manager/issue-handlers";
import { Schema } from "effect";
import { Notice } from "obsidian";
import {
	type CommandRecoveryOutcome,
	CommandRecoveryOutcomeSchema,
} from "../../../base-command-error";

// ─── Error Kind Enum ───

const SIMPLE_SPLIT_ERROR_KINDS = [
	"NoPwd",
	"NoContent",
	"ParseFailed",
	"IntentionFailed",
	"LibrarianUnavailable",
] as const;

export class SplitToPagesInputError extends Schema.TaggedError<SplitToPagesInputError>()(
	"SplitToPagesInputError",
	{
		kind: Schema.Literals(SIMPLE_SPLIT_ERROR_KINDS),
		reason: Schema.String,
	},
) {}

export class SplitToPagesDispatchError extends Schema.TaggedError<SplitToPagesDispatchError>()(
	"SplitToPagesDispatchError",
	{
		execution: Schema.Literals([
			"FailedBeforeExecution",
			"ExecutionUncertain",
		]),
		kind: Schema.Literal("DispatchFailed"),
		operationId: Schema.String,
		phase: Schema.Literal("InitialVaultDispatch"),
		reason: Schema.String,
		recovery: CommandRecoveryOutcomeSchema,
	},
) {}

export class SplitToPagesReconciliationError extends Schema.TaggedError<SplitToPagesReconciliationError>()(
	"SplitToPagesReconciliationError",
	{
		kind: Schema.Literal("ReconciliationFailed"),
		operationId: Schema.String,
		phase: Schema.Literal("SemanticReconciliation"),
		reason: Schema.String,
		reconciliationId: Schema.String,
		recovery: CommandRecoveryOutcomeSchema,
		status: Schema.Literals(["Failed", "PartialFailure"]),
	},
) {}

export class SplitToPagesNavigationError extends Schema.TaggedError<SplitToPagesNavigationError>()(
	"SplitToPagesNavigationError",
	{
		kind: Schema.Literal("NavigationFailed"),
		operationId: Schema.String,
		phase: Schema.Literal("Navigation"),
		reason: Schema.String,
	},
) {}

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

export function handleSplitToPagesError(error: SplitToPagesError): void {
	logError({
		description: `${error.kind}: ${error.reason}`,
		location: "splitToPagesAction",
	});
	new Notice(ERROR_MESSAGES[error.kind]);
}
