/**
 * A problem pure Library code met and stepped over, such as a scroll whose
 * path could not be computed. Library code logs nothing: it returns its
 * issues with its result, and the Librarian logs them under its span.
 */
export type LibraryIssue = {
	readonly severity: "Warning" | "Error";
	/** Where it was met and what was skipped, such as `[Codex] …`. */
	readonly message: string;
	/** The error the step that was skipped returned. */
	readonly error: unknown;
};

export const libraryWarning = (
	message: string,
	error: unknown,
): LibraryIssue => ({ error, message, severity: "Warning" });

export const libraryError = (
	message: string,
	error: unknown,
): LibraryIssue => ({ error, message, severity: "Error" });
