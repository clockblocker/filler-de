// Error message builders
export function errorGetByPath(
	entityType: "file" | "folder",
	path: string,
): string {
	return `Failed to get ${entityType} by path: ${path}`;
}

export function errorTypeMismatch(
	entityType: "file" | "folder",
	path: string,
): string {
	return `Expected ${entityType} kind missmatched the found kind: ${path}`;
}

export function errorCreationRaceCondition(
	entityType: "file" | "folder",
	path: string,
	retrievalError: string,
): string {
	return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} creation race condition: ${path} was created but cannot be retrieved: ${retrievalError}`;
}

export function errorCreateFailed(
	entityType: "file" | "folder",
	path: string,
	errorMessage: string,
): string {
	return `Failed to create ${entityType}: ${path}: ${errorMessage}`;
}

export function errorBothSourceAndTargetNotFound(
	entityType: "file" | "folder",
	fromPath: string,
	toPath: string,
	error: string,
): string {
	return `Both source (${fromPath}) and target (${toPath}) ${entityType}s not found: ${error}`;
}

export function errorRetrieveRenamed(
	entityType: "file" | "folder",
	path: string,
	error: string,
): string {
	return `Failed to retrieve renamed ${entityType}: ${path}: ${error}`;
}

export function errorRenameFailed(
	entityType: "file" | "folder",
	fromPath: string,
	toPath: string,
	errorMessage: string,
): string {
	return `Failed to rename ${entityType}: ${fromPath} to ${toPath}: ${errorMessage}`;
}

export function errorTrashDuplicateFile(
	path: string,
	errorMessage: string,
): string {
	return `Failed to trash duplicate file: ${path}: ${errorMessage}`;
}

export function errorWriteFailed(
	entityType: "file" | "folder",
	path: string,
	errorMessage: string,
): string {
	return `Failed to write ${entityType}: ${path}: ${errorMessage}`;
}

export function errorNoTFileFound(path: string): string {
	return `No TFile found for path: ${path}`;
}
