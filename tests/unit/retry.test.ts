import { describe, expect, it } from "bun:test";
import { withRetry } from "../../src/stateless-helpers/retry";

const noJitterConfig = {
	baseDelayMs: 100,
	jitter: 0,
	maxAttempts: 3,
	multiplier: 2,
};

const instantSleep = () => Promise.resolve();

const mapError = (e: unknown) => ({
	reason: e instanceof Error ? e.message : String(e),
});

describe("withRetry", () => {
	it("succeeds on first attempt — no retry", async () => {
		let callCount = 0;
		const result = await withRetry(
			async () => {
				callCount++;
				return "ok";
			},
			() => true,
			mapError,
			noJitterConfig,
			instantSleep,
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe("ok");
		expect(callCount).toBe(1);
	});

	it("retries on retryable error and succeeds on 2nd attempt", async () => {
		let callCount = 0;
		const result = await withRetry(
			async () => {
				callCount++;
				if (callCount < 2) throw new Error("transient");
				return "recovered";
			},
			() => true,
			mapError,
			noJitterConfig,
			instantSleep,
		);

		expect(result.isOk()).toBe(true);
		expect(result._unsafeUnwrap()).toBe("recovered");
		expect(callCount).toBe(2);
	});

	it("exhausts all attempts and returns err", async () => {
		let callCount = 0;
		const result = await withRetry(
			async () => {
				callCount++;
				throw new Error("persistent");
			},
			() => true,
			mapError,
			noJitterConfig,
			instantSleep,
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toEqual({
			reason: "persistent",
		});
		expect(callCount).toBe(3);
	});

	it("does not retry non-retryable errors", async () => {
		let callCount = 0;
		const result = await withRetry(
			async () => {
				callCount++;
				throw new Error("fatal");
			},
			() => false,
			mapError,
			noJitterConfig,
			instantSleep,
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toEqual({ reason: "fatal" });
		expect(callCount).toBe(1);
	});

	it("applies exponential backoff delays", async () => {
		const delays: number[] = [];
		const trackingSleep = (ms: number) => {
			delays.push(ms);
			return Promise.resolve();
		};

		let callCount = 0;
		await withRetry(
			async () => {
				callCount++;
				throw new Error("fail");
			},
			() => true,
			mapError,
			noJitterConfig,
			trackingSleep,
		);

		// 3 attempts → 2 sleeps (after attempt 1 and 2, not after final attempt)
		expect(delays).toHaveLength(2);
		// baseDelay=100, multiplier=2, jitter=0: delays should be 100, 200
		expect(delays[0]).toBe(100);
		expect(delays[1]).toBe(200);
	});

	it("uses the isRetryable predicate per error", async () => {
		let callCount = 0;
		const result = await withRetry(
			async () => {
				callCount++;
				if (callCount === 1) throw new Error("retryable");
				throw new Error("fatal");
			},
			(e) => e instanceof Error && e.message === "retryable",
			mapError,
			noJitterConfig,
			instantSleep,
		);

		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr()).toEqual({ reason: "fatal" });
		expect(callCount).toBe(2);
	});
});
