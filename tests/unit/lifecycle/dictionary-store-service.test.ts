import { describe, expect, it } from "bun:test";
import { Effect, Fiber } from "effect";
import { createDictionaryStoreService } from "../../../src/lifecycle/dictionary-store-service";
import { defaultRunner } from "../../support/effect-runner";

function makeHarness(failBuilds = 0) {
	const events: string[] = [];
	const failures: unknown[] = [];
	let builds = 0;
	let left = failBuilds;
	const service = createDictionaryStoreService({
		build: () =>
			Effect.suspend(() => {
				const id = builds++;
				events.push(`build ${id}`);
				if (left > 0) {
					left--;
					return Effect.fail(new Error(`scan ${id} failed`));
				}
				return Effect.succeed({ id });
			}),
		close: (store) =>
			Effect.sync(() => {
				events.push(`close ${store.id}`);
			}),
		onBuildFailed: (error) => failures.push(error),
		runtime: defaultRunner,
	});
	return { events, failures, service };
}

describe("dictionary store service", () => {
	it("tells no failure for a build the unloading runtime interrupted", async () => {
		const failures: unknown[] = [];
		const service = createDictionaryStoreService({
			build: () => Effect.never,
			close: () => Effect.void,
			onBuildFailed: (error) => failures.push(error),
			// Interrupts the build at once, as disposing the runtime does.
			runtime: {
				...defaultRunner,
				runPromise: (effect) => {
					const fiber = Effect.runFork(effect);
					fiber.interruptUnsafe();
					return Effect.runPromise(Fiber.join(fiber));
				},
			},
		});
		await expect(service.get()).rejects.toBeDefined();
		expect(failures).toEqual([]);
	});

	it("builds once, on first use", async () => {
		const h = makeHarness();
		expect(h.service.state().kind).toBe("Idle");

		const [first, second] = await Promise.all([
			h.service.get(),
			h.service.get(),
		]);

		expect(first).toBe(second);
		expect(h.events).toEqual(["build 0"]);
		expect(h.service.state().kind).toBe("Running");
	});

	it("tries a failed build again on the next use", async () => {
		const h = makeHarness(1);

		await expect(h.service.get()).rejects.toThrow("scan 0 failed");
		expect(h.service.state().kind).toBe("Failed");
		expect(h.failures).toHaveLength(1);

		expect(await h.service.get()).toEqual({ id: 1 });
		expect(h.service.state().kind).toBe("Running");
	});

	it("closes a built store on stop, and answers no more", async () => {
		const h = makeHarness();
		await h.service.get();

		await Effect.runPromise(h.service.stop);

		expect(h.events).toEqual(["build 0", "close 0"]);
		expect(h.service.state().kind).toBe("Stopped");
		await expect(h.service.get()).rejects.toThrow("the plugin has unloaded");
	});

	it("closes a store still building once its build ends", async () => {
		const h = makeHarness();
		const building = h.service.get();

		await Effect.runPromise(h.service.stop);
		await building;
		await Promise.resolve();
		await Promise.resolve();

		expect(h.events).toEqual(["build 0", "close 0"]);
	});
});
