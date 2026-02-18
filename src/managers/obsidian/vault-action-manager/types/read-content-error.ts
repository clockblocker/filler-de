export const ReadContentErrorKind = {
	FileNotFound: "FileNotFound",
	PermissionDenied: "PermissionDenied",
	Unknown: "Unknown",
} as const;

export type ReadContentErrorKind =
	(typeof ReadContentErrorKind)[keyof typeof ReadContentErrorKind];

export type ReadContentError =
	| {
			kind: typeof ReadContentErrorKind.FileNotFound;
			reason: string;
	  }
	| {
			kind: typeof ReadContentErrorKind.PermissionDenied;
			reason: string;
	  }
	| {
			kind: typeof ReadContentErrorKind.Unknown;
			reason: string;
	  };

export function readContentErrorToReason(error: ReadContentError): string {
	return error.reason;
}

export function isReadContentFileNotFound(error: ReadContentError): boolean {
	return error.kind === ReadContentErrorKind.FileNotFound;
}

export function classifyReadContentError(reason: string): ReadContentError {
	const normalized = reason.trim().toLowerCase();
	if (
		normalized.includes("permission denied") ||
		normalized.includes("eacces")
	) {
		return {
			kind: ReadContentErrorKind.PermissionDenied,
			reason,
		};
	}
	if (
		normalized.includes("file not found") ||
		normalized.includes("failed to get file by path")
	) {
		return {
			kind: ReadContentErrorKind.FileNotFound,
			reason,
		};
	}
	return {
		kind: ReadContentErrorKind.Unknown,
		reason,
	};
}
