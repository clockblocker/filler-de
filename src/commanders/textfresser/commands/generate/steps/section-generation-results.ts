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

/** Unwrap a settled result for a critical section — throws if rejected. */
export function unwrapCritical<T>(
	result: PromiseSettledResult<T>,
	sectionName: string,
): T {
	if (result.status === "fulfilled") return result.value;
	throw new Error(
		`Critical section "${sectionName}" failed: ${result.reason}`,
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
	logger.warn(
		`[generateSections] Optional section "${sectionName}" failed:`,
		result.reason,
	);
	return null;
}
