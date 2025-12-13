export function errorNoActiveView(): string {
	return "File not open or not active";
}

export function errorNoFileParent(): string {
	return "Opened file does not have a parent";
}

export function errorGetEditor(errorMessage?: string): string {
	return `Failed to get editor${errorMessage ? `: ${errorMessage}` : ""}`;
}
