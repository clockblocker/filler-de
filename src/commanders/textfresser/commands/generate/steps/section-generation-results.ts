import type { ResultAsync } from "neverthrow";
import type { ApiServiceError } from "../../../../../stateless-helpers/api-service";
import { logger } from "../../../../../utils/logger";

/** Convert a ResultAsync to a Promise that rejects on err (for use with Promise.allSettled). */
export function unwrapResultAsync<T>(
	ra: ResultAsync<T, ApiServiceError>,
): Promise<T> {
	return ra.match(
		(value) => value,
		(error) => {
			throw new Error(error.reason);
		},
	);
}

/** Unwrap a settled result for an optional section — returns null and logs if rejected. */
export function unwrapOptional<T>(
	result: PromiseSettledResult<T>,
	sectionName: string,
	failedSections: string[],
): T | null {
	if (result.status === "fulfilled") return result.value;
	failedSections.push(sectionName);
	const reason =
		result.reason instanceof Error ? result.reason.message : result.reason;
	logger.warn(
		`[generateSections] Optional section "${sectionName}" failed:`,
		reason,
	);
	return null;
}
