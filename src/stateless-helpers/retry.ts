import { ResultAsync } from "neverthrow";
import { logger } from "../utils/logger";

export type RetryConfig = {
	maxAttempts: number;
	baseDelayMs: number;
	multiplier: number;
	/** Jitter fraction ±, e.g. 0.2 means ±20% */
	jitter: number;
};

const DEFAULT_CONFIG: RetryConfig = {
	baseDelayMs: 1000,
	jitter: 0.2,
	maxAttempts: 3,
	multiplier: 2,
};

/**
 * Retry a fallible async operation with exponential backoff.
 *
 * @param fn         — the operation to attempt (may throw)
 * @param isRetryable — predicate: should we retry this error?
 * @param mapError   — convert caught unknown → typed error E
 * @param config     — backoff params (defaults: 3 attempts, 1s base, 2× multiplier, ±20% jitter)
 * @param sleep      — injectable delay for testing (defaults to real setTimeout)
 */
export function withRetry<T, E>(
	fn: () => Promise<T>,
	isRetryable: (error: unknown) => boolean,
	mapError: (error: unknown) => E,
	config: RetryConfig = DEFAULT_CONFIG,
	sleep: (ms: number) => Promise<void> = defaultSleep,
): ResultAsync<T, E> {
	return ResultAsync.fromPromise(
		retryLoop(fn, isRetryable, config, sleep),
		mapError,
	);
}

async function retryLoop<T>(
	fn: () => Promise<T>,
	isRetryable: (error: unknown) => boolean,
	config: RetryConfig,
	sleep: (ms: number) => Promise<void>,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (!isRetryable(error) || attempt === config.maxAttempts) {
				throw error;
			}

			const baseDelay =
				config.baseDelayMs * config.multiplier ** (attempt - 1);
			const jitterRange = baseDelay * config.jitter;
			const jitter = (Math.random() * 2 - 1) * jitterRange;
			const delay = Math.max(0, baseDelay + jitter);

			logger.info(
				`[retry] Attempt ${attempt}/${config.maxAttempts} failed, retrying in ${Math.round(delay)}ms`,
			);

			await sleep(delay);
		}
	}

	// Should never reach here, but just in case
	throw lastError;
}

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
