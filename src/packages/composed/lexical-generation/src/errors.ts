export enum LexicalGenerationFailureKind {
	UnsupportedLanguagePair = "UnsupportedLanguagePair",
	UnsupportedOperation = "UnsupportedOperation",
	InvalidSelection = "InvalidSelection",
	PromptNotAvailable = "PromptNotAvailable",
	InvalidModelOutput = "InvalidModelOutput",
	FetchFailed = "FetchFailed",
	InternalContractViolation = "InternalContractViolation",
}

export type LexicalGenerationError = {
	kind: LexicalGenerationFailureKind;
	message: string;
	details?: Record<string, unknown>;
};

export function lexicalGenerationError(
	kind: LexicalGenerationFailureKind,
	message: string,
	details?: Record<string, unknown>,
): LexicalGenerationError {
	return { details, kind, message };
}
