export function errorNoActiveView(): string {
	return "File not open or not active";
}

export function errorNoFileParent(): string {
	return "Opened file does not have a parent";
}

export function errorGetEditor(errorMessage?: string): string {
	return `Failed to get editor${errorMessage ? `: ${errorMessage}` : ""}`;
}

export function errorNoTFileFound(path: string): string {
	return `No TFile found for path: ${path}`;
}

export function errorInvalidCdArgument(): string {
	return "Invalid argument to OpenedFileService.cd";
}

export function errorOpenFileFailed(errorMessage: string): string {
	return `Failed to open file: ${errorMessage}`;
}
