import { Notice } from 'obsidian';

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
}: TextfresserError & { issueType: 'error' | 'warning' }): void {
	const errorMessage = formatError({
		description,
		location,
	});

	if (withNotice) {
		new Notice(errorMessage);
	}

	if (withLogs) {
		issueType === 'error'
			? console.error(errorMessage)
			: console.warn(errorMessage);
	}
}

export function logError({ description, location }: TextfresserError): void {
	handleIssue({
		description,
		location,
		withNotice: true,
		withLogs: true,
		issueType: 'error',
	});
}

export function logWarning({ description, location }: TextfresserError): void {
	handleIssue({
		description,
		location,
		withNotice: false,
		withLogs: true,
		issueType: 'warning',
	});
}
