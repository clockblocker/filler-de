import { Effect } from "effect";

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
};

export function formatError({
	description,
	location,
}: TextfresserError): string {
	return `[Textfresser] ${location ? `[${location}]: ${description}` : description}`;
}

/** Shows the error in a Notice, and logs it under the current span. */
export const logError = Effect.fnUntraced(function* (error: TextfresserError) {
	const message = formatError(error);
	yield* Effect.sync(() => {
		if (Notice) new Notice(message);
	});
	yield* Effect.logError(message);
});

/** Logs the warning under the current span; it shows no Notice. */
export const logWarning = (warning: TextfresserError): Effect.Effect<void> =>
	Effect.logWarning(formatError(warning));
