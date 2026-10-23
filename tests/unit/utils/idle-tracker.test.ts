import { describe, expect, it } from "bun:test";
import { Deferred, Effect, Fiber } from "effect";
import { IdleTracker, makeIdleTracker } from "../../../src/utils/idle-tracker";

/** Ends after `ms` of wall time. */
const pause = (ms: number) =>
	Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("idle tracker", () => {
	it("waits for tracked work, then for a grace with none", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const idle = yield* makeIdleTracker;
				const gate = yield* Deferred.make<void>();
				const work = yield* Effect.forkChild(idle.track(Deferred.await(gate)));
				yield* pause(5);
				expect(yield* idle.pending).toBe(1);

				const waiting = yield* Effect.forkChild(idle.whenIdle("30 millis"));
				yield* pause(60);
				expect(waiting.pollUnsafe()).toBeUndefined();

				yield* Deferred.succeed(gate, undefined);
				yield* Fiber.join(work);
				expect(yield* idle.pending).toBe(0);
				yield* Fiber.join(waiting);
			}),
		);
	});

	it("waits again when work begins within the grace", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const idle = yield* makeIdleTracker;
				const waiting = yield* Effect.forkChild(idle.whenIdle("40 millis"));
				yield* pause(15);
				yield* idle.start;
				yield* pause(60);
				expect(waiting.pollUnsafe()).toBeUndefined();
				yield* idle.end;
				yield* Fiber.join(waiting);
			}),
		);
	});

	it("counts nothing where the plugin runtime does not provide one", async () => {
		const pending = await Effect.runPromise(
			Effect.gen(function* () {
				const idle = yield* IdleTracker;
				yield* idle.start;
				return yield* idle.pending;
			}),
		);
		expect(pending).toBe(0);
	});
});
