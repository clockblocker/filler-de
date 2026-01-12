import type { ZodIssue } from "zod";

/**
 * Structured error types for codec operations.
 * All parse functions return `Result<T, CodecError>`.
 * Enables actionable error messages, stable error classification, and pattern matching.
 */
export type CodecError =
	| {
			kind: "SegmentIdError";
			reason:
				| "MissingParts"
				| "UnknownType"
				| "InvalidFormat"
				| "InvalidNodeName"
				| "InvalidExtension";
			raw: string;
			message: string;
			context?: Record<string, unknown>;
			cause?: CodecError;
	  }
	| {
			kind: "SuffixError";
			reason: "InvalidDelimiter" | "EmptyParts" | "InvalidNodeName";
			raw: string;
			message: string;
			context?: Record<string, unknown>;
			cause?: CodecError;
	  }
	| {
			kind: "SplitPathError";
			reason:
				| "InvalidPathParts"
				| "InvalidBasename"
				| "MissingExtension"
				| "CanonicalizationFailed"
				| "OutsideLibrary";
			message: string;
			context: Record<string, unknown>;
			cause?: CodecError;
	  }
	| {
			kind: "LocatorError";
			reason: "NoParent" | "InvalidChain" | "InvalidSegmentId";
			message: string;
			context: Record<string, unknown>;
			cause?: CodecError;
	  }
	| {
			kind: "ZodError";
			issues: ZodIssue[];
			message: string;
			context?: Record<string, unknown>;
			cause?: CodecError;
	  };

/**
 * Error constructors for consistent error creation.
 */
export const makeSegmentIdError = (
	reason: CodecError & { kind: "SegmentIdError" }["reason"],
	raw: string,
	message: string,
	context?: Record<string, unknown>,
	cause?: CodecError,
): CodecError => ({
	kind: "SegmentIdError",
	reason,
	raw,
	message,
	context,
	cause,
});

export const makeSuffixError = (
	reason: CodecError & { kind: "SuffixError" }["reason"],
	raw: string,
	message: string,
	context?: Record<string, unknown>,
	cause?: CodecError,
): CodecError => ({
	kind: "SuffixError",
	reason,
	raw,
	message,
	context,
	cause,
});

export const makeSplitPathError = (
	reason: CodecError & { kind: "SplitPathError" }["reason"],
	message: string,
	context: Record<string, unknown>,
	cause?: CodecError,
): CodecError => ({
	kind: "SplitPathError",
	reason,
	message,
	context,
	cause,
});

export const makeLocatorError = (
	reason: CodecError & { kind: "LocatorError" }["reason"],
	message: string,
	context: Record<string, unknown>,
	cause?: CodecError,
): CodecError => ({
	kind: "LocatorError",
	reason,
	message,
	context,
	cause,
});

export const makeZodError = (
	issues: ZodIssue[],
	message: string,
	context?: Record<string, unknown>,
	cause?: CodecError,
): CodecError => ({
	kind: "ZodError",
	issues,
	message,
	context,
	cause,
});
