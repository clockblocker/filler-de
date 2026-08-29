import { describe, expect, test } from "bun:test";
import { Deferred, Effect, Fiber } from "effect";

import { VaultActionQueue } from "../../../src/commanders/librarian/runtime/vault-action-queue";

describe("VaultActionQueue", () => {
	test("processes enqueued work one at a time in FIFO order", async () => {
		const events = await Effect.runPromise(
			Effect.gen(function* () {
				const firstStarted = yield* Deferred.make<void>();
				const releaseFirst = yield* Deferred.make<void>();
				const events: string[] = [];
				const queue = yield* VaultActionQueue.make<number, never>(
					Effect.fn("testProcessor")(function* (item) {
						events.push(`start:${item}`);
						if (item === 1) {
							yield* Deferred.succeed(firstStarted, undefined);
							yield* Deferred.await(releaseFirst);
						}
						events.push(`end:${item}`);
					}),
				);

				const first = yield* queue.enqueue(1).pipe(Effect.forkChild);
				yield* Deferred.await(firstStarted);
				const second = yield* queue.enqueue(2).pipe(Effect.forkChild);
				yield* Effect.yieldNow;

				expect(events).toEqual(["start:1"]);
				yield* Deferred.succeed(releaseFirst, undefined);
				yield* Fiber.join(first);
				yield* Fiber.join(second);
				return events;
			}),
		);

		expect(events).toEqual(["start:1", "end:1", "start:2", "end:2"]);
	});

	test("waitForDrain waits behind work already in the queue", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const started = yield* Deferred.make<void>();
				const release = yield* Deferred.make<void>();
				const processed: number[] = [];
				const queue = yield* VaultActionQueue.make<number, never>(
					Effect.fn("testProcessor")(function* (item) {
						if (item === 1) {
							yield* Deferred.succeed(started, undefined);
							yield* Deferred.await(release);
						}
						processed.push(item);
					}),
				);

				const first = yield* queue.enqueue(1).pipe(Effect.forkChild);
				yield* Deferred.await(started);
				const second = yield* queue.enqueue(2).pipe(Effect.forkChild);
				yield* Effect.yieldNow;
				const drain = yield* queue.waitForDrain().pipe(Effect.forkChild);
				yield* Effect.yieldNow;

				expect(drain.pollUnsafe()).toBeUndefined();
				yield* Deferred.succeed(release, undefined);
				yield* Fiber.join(drain);
				expect(processed).toEqual([1, 2]);
				yield* Fiber.join(first);
				yield* Fiber.join(second);
			}),
		);
	});

	test("propagates an item failure and continues with later work", async () => {
		await Effect.runPromise(
			Effect.gen(function* () {
				const failingStarted = yield* Deferred.make<void>();
				const releaseFailure = yield* Deferred.make<void>();
				const processed: string[] = [];
				const queue = yield* VaultActionQueue.make<string, "failed">(
					Effect.fn("testProcessor")(function* (item) {
						if (item === "fail") {
							yield* Deferred.succeed(failingStarted, undefined);
							yield* Deferred.await(releaseFailure);
							return yield* Effect.fail("failed" as const);
						}
						processed.push(item);
					}),
				);

				const failure = yield* queue
					.enqueue("fail")
					.pipe(Effect.flip, Effect.forkChild);
				yield* Deferred.await(failingStarted);
				const next = yield* queue.enqueue("next").pipe(Effect.forkChild);
				yield* Deferred.succeed(releaseFailure, undefined);

				expect(yield* Fiber.join(failure)).toBe("failed");
				yield* Fiber.join(next);
				expect(processed).toEqual(["next"]);
			}),
		);
	});
});
