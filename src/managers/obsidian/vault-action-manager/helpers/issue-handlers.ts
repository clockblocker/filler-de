import { logger } from "../../../../utils/logger";

// Notice is optional - may not be available in test environment
let Notice: (new (message: string) => unknown) | null = null;
try {
	// Dynamic import would be better but causes issues with bundling
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	Notice = require("obsidian").Notice;
} catch {
	// Notice not available (test environment)
}

type TextfresserError = {
	description: string;
	location?: string;
	withNotice?: boolean;
	withLogs?: boolean;
};

export function formatError({
	description,
	location,
}: TextfresserError): string {
	return `[Textfresser] ${location ? `[${location}]: ${description}` : description}`;
}

function handleIssue({
	description,
	location,
	withNotice,
	withLogs,
	issueType,
}: TextfresserError & { issueType: "error" | "warning" }): void {
	const errorMessage = formatError({
		description,
		location,
	});

	if (withNotice && Notice) {
		new Notice(errorMessage);
	}

	if (withLogs) {
		issueType === "error"
			? logger.error(errorMessage)
			: logger.warn(errorMessage);
	}
}

export function logError({ description, location }: TextfresserError): void {
	handleIssue({
		description,
		issueType: "error",
		location,
		withLogs: true,
		withNotice: true,
	});
}

export function logWarning({ description, location }: TextfresserError): void {
	handleIssue({
		description,
		issueType: "warning",
		location,
		withLogs: true,
		withNotice: false,
	});
}
