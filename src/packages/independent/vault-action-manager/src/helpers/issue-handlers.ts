import { Effect } from "effect";

type TextfresserError = {
	description: string;
	location?: string;
};

/**
 * The text of an error as the plugin tells and logs it. Showing it is the
 * host's: VAM shows no Notice.
 */
export function formatError({
	description,
	location,
}: TextfresserError): string {
	return `[Textfresser] ${location ? `[${location}]: ${description}` : description}`;
}

/** Logs the warning under the current span; it shows no Notice. */
export const logWarning = (warning: TextfresserError): Effect.Effect<void> =>
	Effect.logWarning(formatError(warning));
