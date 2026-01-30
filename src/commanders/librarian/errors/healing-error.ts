/**
 * HealingError - Unified error type for the healing system.
 *
 * This module provides a discriminated union of all error types that can occur
 * during healing operations. All healing functions should return
 * Result<T, HealingError> instead of throwing.
 *
 * Benefits:
 * - No silent continues or ignoring errors
 * - Callers can handle specific error kinds
 * - Errors can be aggregated and reported
 * - Enables transaction-based healing with rollback
 */

import type { VaultAction } from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import type {
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import type { HealingAction } from "../healer/library-tree/types/healing-action";

// ─── Error Types ───

/**
 * Error when parsing a segment ID fails.
 */
export type ParseError = {
	kind: "ParseFailed";
	segmentId: string;
	reason: string;
	context?: Record<string, unknown>;
};

/**
 * Error when expected and actual paths don't match.
 */
export type PathMismatchError = {
	kind: "PathMismatch";
	expected:
		| SplitPathToMdFileInsideLibrary
		| SplitPathToFileInsideLibrary
		| { pathParts: string[]; basename: string };
	actual:
		| SplitPathToMdFileInsideLibrary
		| SplitPathToFileInsideLibrary
		| { pathParts: string[]; basename: string };
	reason: string;
};

/**
 * Error when a vault operation fails.
 */
export type VaultOperationError = {
	kind: "VaultFailed";
	action: VaultAction | HealingAction;
	error: string;
	recoverable: boolean;
};

/**
 * Error when tree state is inconsistent.
 */
export type TreeInconsistencyError = {
	kind: "TreeInconsistent";
	details: string;
	nodeLocator?: string;
};

/**
 * Error when a node is not found.
 */
export type NodeNotFoundError = {
	kind: "NodeNotFound";
	locator: string;
	reason: string;
};

/**
 * Error when a chain is empty or invalid.
 */
export type InvalidChainError = {
	kind: "InvalidChain";
	chain: string[];
	reason: string;
};

/**
 * Error when codex computation fails.
 */
export type CodexComputationError = {
	kind: "CodexComputationFailed";
	sectionChain: string[];
	reason: string;
};

/**
 * Error when validation fails.
 */
export type ValidationError = {
	kind: "ValidationFailed";
	field: string;
	value: unknown;
	reason: string;
};

/**
 * Generic internal error for unexpected situations.
 */
export type InternalError = {
	kind: "InternalError";
	message: string;
	cause?: Error;
};

// ─── Union Type ───

/**
 * Discriminated union of all healing errors.
 * All healing functions should return Result<T, HealingError>.
 */
export type HealingError =
	| ParseError
	| PathMismatchError
	| VaultOperationError
	| TreeInconsistencyError
	| NodeNotFoundError
	| InvalidChainError
	| CodexComputationError
	| ValidationError
	| InternalError;

// ─── Error Constructors ───

export function makeParseError(
	segmentId: string,
	reason: string,
	context?: Record<string, unknown>,
): ParseError {
	return { context, kind: "ParseFailed", reason, segmentId };
}

export function makePathMismatchError(
	expected: PathMismatchError["expected"],
	actual: PathMismatchError["actual"],
	reason: string,
): PathMismatchError {
	return { actual, expected, kind: "PathMismatch", reason };
}

export function makeVaultOperationError(
	action: VaultAction | HealingAction,
	error: string,
	recoverable = false,
): VaultOperationError {
	return { action, error, kind: "VaultFailed", recoverable };
}

export function makeTreeInconsistencyError(
	details: string,
	nodeLocator?: string,
): TreeInconsistencyError {
	return { details, kind: "TreeInconsistent", nodeLocator };
}

export function makeNodeNotFoundError(
	locator: string,
	reason: string,
): NodeNotFoundError {
	return { kind: "NodeNotFound", locator, reason };
}

export function makeInvalidChainError(
	chain: string[],
	reason: string,
): InvalidChainError {
	return { chain, kind: "InvalidChain", reason };
}

export function makeCodexComputationError(
	sectionChain: string[],
	reason: string,
): CodexComputationError {
	return { kind: "CodexComputationFailed", reason, sectionChain };
}

export function makeValidationError(
	field: string,
	value: unknown,
	reason: string,
): ValidationError {
	return { field, kind: "ValidationFailed", reason, value };
}

export function makeInternalError(
	message: string,
	cause?: Error,
): InternalError {
	return { cause, kind: "InternalError", message };
}

// ─── Error Utilities ───

/**
 * Format a HealingError for logging.
 */
export function formatHealingError(error: HealingError): string {
	switch (error.kind) {
		case "ParseFailed":
			return `Parse failed for segment '${error.segmentId}': ${error.reason}`;
		case "PathMismatch":
			return `Path mismatch: expected ${JSON.stringify(error.expected)}, got ${JSON.stringify(error.actual)}. ${error.reason}`;
		case "VaultFailed":
			return `Vault operation failed: ${error.error} (recoverable: ${error.recoverable})`;
		case "TreeInconsistent":
			return `Tree inconsistent: ${error.details}${error.nodeLocator ? ` at ${error.nodeLocator}` : ""}`;
		case "NodeNotFound":
			return `Node not found: ${error.locator}. ${error.reason}`;
		case "InvalidChain":
			return `Invalid chain [${error.chain.join(" -> ")}]: ${error.reason}`;
		case "CodexComputationFailed":
			return `Codex computation failed for [${error.sectionChain.join(" -> ")}]: ${error.reason}`;
		case "ValidationFailed":
			return `Validation failed for '${error.field}': ${error.reason}`;
		case "InternalError":
			return `Internal error: ${error.message}${error.cause ? ` (caused by: ${error.cause.message})` : ""}`;
	}
}

/**
 * Check if an error is recoverable (can retry or continue).
 */
export function isRecoverableError(error: HealingError): boolean {
	switch (error.kind) {
		case "VaultFailed":
			return error.recoverable;
		case "NodeNotFound":
		case "PathMismatch":
			// These might be recoverable by re-syncing state
			return true;
		case "ParseFailed":
		case "TreeInconsistent":
		case "InvalidChain":
		case "CodexComputationFailed":
		case "ValidationFailed":
		case "InternalError":
			// These indicate bugs or corruption
			return false;
	}
}

/**
 * Aggregate multiple errors into a summary.
 */
export function aggregateErrors(errors: HealingError[]): string {
	if (errors.length === 0) return "No errors";
	if (errors.length === 1) {
		const first = errors[0];
		if (first) return formatHealingError(first);
		return "No errors";
	}

	const summary = errors.reduce(
		(acc, e) => {
			acc[e.kind] = (acc[e.kind] ?? 0) + 1;
			return acc;
		},
		{} as Record<string, number>,
	);

	const parts = Object.entries(summary).map(
		([kind, count]) => `${kind}: ${count}`,
	);
	return `${errors.length} errors (${parts.join(", ")})`;
}
