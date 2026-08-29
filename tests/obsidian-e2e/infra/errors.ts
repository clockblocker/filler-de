export type HarnessErrorCode =
	| "ARTIFACT_INVALID"
	| "CLI_INVALID"
	| "CLI_NON_ZERO"
	| "CLI_PROTOCOL"
	| "CLI_REPORTED_ERROR"
	| "CLI_TIMEOUT"
	| "HOST_BUSY"
	| "LOCK_BUSY"
	| "PROCESS_FAILED"
	| "SESSION_INVALID";

export interface HarnessErrorDetails {
	readonly args?: readonly string[];
	readonly cause?: unknown;
	readonly command?: string;
	readonly exitCode?: number;
	readonly stderr?: string;
	readonly stdout?: string;
	readonly timeoutMs?: number;
}

export class HarnessError extends Error {
	constructor(
		public readonly code: HarnessErrorCode,
		message: string,
		public readonly details: HarnessErrorDetails = {},
	) {
		super(message, { cause: details.cause });
		this.name = "HarnessError";
	}
}

export function describeError(error: unknown): string {
	if (error instanceof HarnessError) {
		const details = [
			error.details.command,
			error.details.exitCode === undefined
				? undefined
				: `exit=${error.details.exitCode}`,
			error.details.stdout ? `stdout=${error.details.stdout}` : undefined,
			error.details.stderr ? `stderr=${error.details.stderr}` : undefined,
		]
			.filter((part): part is string => Boolean(part))
			.join("\n");
		return details
			? `[${error.code}] ${error.message}\n${details}`
			: `[${error.code}] ${error.message}`;
	}

	return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
