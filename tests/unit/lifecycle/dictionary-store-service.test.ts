import { describe, expect, it } from "bun:test";
import {
	type Cause,
	Deferred,
	Effect,
	Exit,
	Fiber,
	Scope,
	SubscriptionRef,
} from "effect";
import {
	DictionaryStoreClosed,
	makeDictionaryStoreService,
} from "../../../src/lifecycle/dictionary-store-service";

/** A service whose builds the test lets end, one by one, or fail. */
function makeHarness(options: { readonly failBuilds?: number } = {}) {
	const events: string[] = [];
	const failures: Cause.Cause<Error>[] = [];
	const gates: Deferred.Deferred<void>[] = [];
	let builds = 0;
	let left = options.failBuilds ?? 0;
	const make = makeDictionaryStoreService({
		build: Effect.suspend(() => {
			const id = builds++;
			events.push(`build ${id}`);
			const gate = Deferred.makeUnsafe<void>();
			gates.push(gate);
			return Deferred.await(gate).pipe(
				Effect.onInterrupt(() =>
					Effect.sync(() => {
						events.push(`interrupt ${id}`);
					}),
				),
				Effect.andThen(() => {
					if (left > 0) {
						left--;
						return Effect.fail(new Error(`scan ${id} failed`));
					}
					return Effect.succeed({ id });
				}),
			);
		}),
		close: (store) =>
			Effect.sync(() => {
				events.push(`close ${store.id}`);
			}),
		onBuildFailed: (cause) =>
			Effect.sync(() => {
				failures.push(cause);
			}),
	});
	return { events, failures, gates, make };
}

/** Lets every fiber that can move, move. */
const settle = Effect.promise(
	() => new Promise((resolve) => setTimeout(resolve, 0)),
);

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
	Effect.runPromise(Effect.scoped(effect));

describe("dictionary store service", () => {
	it("starts its build as it is made, and every use shares it, even the first ones at once", async () => {
		const h = makeHarness();
		await run(
			Effect.gen(function* () {
				const service = yield* h.make;
				yield* settle;
				expect(h.events).toEqual(["build 0"]);
				expect((yield* SubscriptionRef.get(service.state)).kind).toBe(
					"Starting",
				);

				const uses = yield* Effect.all(
					[service.get, service.get, service.get],
					{ concurrency: "unbounded" },
				).pipe(Effect.forkChild);
				yield* settle;
				yield* Deferred.succeed(h.gates[0] as Deferred.Deferred<void>, undefined);
				const [first, second, third] = yield* Fiber.join(uses);

				expect(first).toBe(second);
				expect(second).toBe(third);
				expect(yield* service.get).toBe(first);
				expect(h.events).toEqual(["build 0"]);
				expect((yield* SubscriptionRef.get(service.state)).kind).toBe(
					"Running",
				);
			}),
		);
	});

	it("tries a failed build again on the next use", async () => {
		const h = makeHarness({ failBuilds: 1 });
		await run(
			Effect.gen(function* () {
				const service = yield* h.make;
				const first = yield* Effect.forkChild(Effect.flip(service.get));
				yield* settle;
				yield* Deferred.succeed(h.gates[0] as Deferred.Deferred<void>, undefined);
				expect(yield* Fiber.join(first)).toEqual(new Error("scan 0 failed"));
				const state = yield* SubscriptionRef.get(service.state);
				expect(state.kind).toBe("Failed");
				// The state keeps the build's whole cause, as the log does.
				if (state.kind === "Failed")
					expect([state.cause]).toEqual(h.failures);

				const retry = yield* Effect.forkChild(service.get);
				yield* settle;
				expect(h.events).toEqual(["build 0", "build 1"]);
				yield* Deferred.succeed(h.gates[1] as Deferred.Deferred<void>, undefined);
				expect(yield* Fiber.join(retry)).toEqual(
					{ id: 1 },
				);
				expect((yield* SubscriptionRef.get(service.state)).kind).toBe(
					"Running",
				);
			}),
		);
	});

	it("closes a built store with its scope, and answers no more", async () => {
		const h = makeHarness();
		const scope = Scope.makeUnsafe();
		const service = await Effect.runPromise(Scope.provide(h.make, scope));
		await Effect.runPromise(settle);
		Deferred.doneUnsafe(h.gates[0] as Deferred.Deferred<void>, Effect.void);
		await Effect.runPromise(service.get);

		await Effect.runPromise(Scope.close(scope, Exit.void));

		expect(h.events).toEqual(["build 0", "close 0"]);
		expect((await Effect.runPromise(SubscriptionRef.get(service.state))).kind).toBe(
			"Stopped",
		);
		const late = await Effect.runPromise(Effect.flip(service.get));
		expect(late).toBeInstanceOf(DictionaryStoreClosed);
		expect(h.events).toEqual(["build 0", "close 0"]);
	});

	it("interrupts a build still under way as its scope closes, tells no failure, and leaves no store open", async () => {
		const h = makeHarness();
		const scope = Scope.makeUnsafe();
		const service = await Effect.runPromise(Scope.provide(h.make, scope));
		const waiting = Effect.runPromiseExit(service.get);
		await Effect.runPromise(settle);

		await Effect.runPromise(Scope.close(scope, Exit.void));
		// The scan would have ended now; nothing builds or closes after.
		Deferred.doneUnsafe(h.gates[0] as Deferred.Deferred<void>, Effect.void);
		await Effect.runPromise(settle);

		expect(h.events).toEqual(["build 0", "interrupt 0"]);
		expect(h.failures).toEqual([]);
		const exit = await waiting;
		expect(Exit.isFailure(exit)).toBe(true);
		expect(Exit.hasInterrupts(exit)).toBe(true);
		expect((await Effect.runPromise(SubscriptionRef.get(service.state))).kind).toBe(
			"Stopped",
		);
	});

	it("closes a store whose build ended as its scope began to close", async () => {
		const h = makeHarness();
		const scope = Scope.makeUnsafe();
		await Effect.runPromise(Scope.provide(h.make, scope));
		await Effect.runPromise(settle);
		// The build ends in the same turn the scope closes.
		Deferred.doneUnsafe(h.gates[0] as Deferred.Deferred<void>, Effect.void);
		await Effect.runPromise(Scope.close(scope, Exit.void));

		const opened = h.events.filter((event) => event === "build 0").length;
		const closed = h.events.filter((event) => event === "close 0").length;
		const interrupted = h.events.includes("interrupt 0");
		// Either it was interrupted before it finished, or it was closed.
		expect(opened).toBe(1);
		expect(interrupted ? closed === 0 : closed === 1).toBe(true);
	});
});
