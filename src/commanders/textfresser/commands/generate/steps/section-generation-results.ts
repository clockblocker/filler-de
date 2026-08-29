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

