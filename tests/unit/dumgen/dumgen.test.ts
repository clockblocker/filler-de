import { describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { operations, TraceSink } from "dumgen";
import { Effect, Exit, Fiber, Layer, ManagedRuntime } from "effect";
import type { RequestUrlParam } from "obsidian";
import {
	Dumgen,
	type DumgenProviderKeys,
	DumgenUnavailable,
	HttpTransport,
	ProviderKeys,
	type RequestUrl,
} from "../../../src/managers/dumgen";
import { KEY_CHECK_URLS } from "../../../src/managers/dumgen/key-check";
import { dumgenLayerOver, dumgenServiceOver, unreachable } from "./dumgen-support";
import { responsesBody, stubRequestUrl } from "./request-url-stub";

const translate = operations.translate.sentence({
	into: "en",
	language: "de",
	sentence: "Der Hund schläft.",
});

/** Keys the test changes as a user would in the settings. */
function settings() {
	const keys: { -readonly [K in keyof DumgenProviderKeys]: string } = {
		openaiApiKey: "sk-first",
		typesafeApiKey: "ts-first",
	};
	let reads = 0;
	return {
		keys,
		read: () => {
			reads++;
			return { ...keys };
		},
		reads: () => reads,
	};
}

/** A `requestUrl` that holds every request until `release()`. */
function heldRequestUrl() {
	const requests: RequestUrlParam[] = [];
	const waiting: (() => void)[] = [];
	const requestUrl: RequestUrl = (request) => {
		requests.push(request);
		return new Promise((resolve) =>
			waiting.push(() =>
				resolve({ status: 200, text: responsesBody("The dog sleeps.") }),
			),
		);
	};
	return {
		release: () => {
			for (const answer of waiting.splice(0)) answer();
		},
		requests,
		requestUrl,
	};
}

const until = async (condition: () => boolean) => {
	for (let waited = 0; !condition(); waited++) {
		if (waited > 1000) throw new Error("timed out");
		await Bun.sleep(1);
	}
};

const authorization = (request: RequestUrlParam | undefined) =>
	request?.headers?.Authorization;

describe("Dumgen", () => {
	it("reads the keys only when an action starts", async () => {
		const keys = settings();
		const dumgen = dumgenServiceOver(
			stubRequestUrl(() => ({
				status: 200,
				text: responsesBody("The dog sleeps."),
			})).requestUrl,
			keys.read,
		);
		expect(keys.reads()).toBe(0);
		await Effect.runPromise(dumgen.provide(translate));
		expect(keys.reads()).toBe(1);
	});

	it("sends with the keys as they are when an action starts, trimmed", async () => {
		const keys = settings();
		const stub = stubRequestUrl(() => ({
			status: 200,
			text: responsesBody("The dog sleeps."),
		}));
		const dumgen = dumgenServiceOver(stub.requestUrl, keys.read);
		await Effect.runPromise(dumgen.provide(translate));
		keys.keys.openaiApiKey = " sk-first ";
		await Effect.runPromise(dumgen.provide(translate));
		keys.keys.openaiApiKey = "sk-second";
		await Effect.runPromise(dumgen.provide(translate));
		expect(stub.requests.map(authorization)).toEqual([
			"Bearer sk-first",
			"Bearer sk-first",
			"Bearer sk-second",
		]);
	});

	it("runs one action's requests on one budget of 16, and gives each action its own", async () => {
		const held = heldRequestUrl();
		const dumgen = dumgenServiceOver(held.requestUrl);
		const many = (count: number) =>
			Effect.all(Array.from({ length: count }, () => translate), {
				concurrency: "unbounded",
			});

		const one = Effect.runPromise(dumgen.provide(many(17)));
		await until(() => held.requests.length === 16);
		await Bun.sleep(20);
		expect(held.requests).toHaveLength(16);
		held.release();
		await until(() => held.requests.length === 17);
		held.release();
		expect(await one).toHaveLength(17);

		const two = Effect.runPromise(
			Effect.all([dumgen.provide(many(16)), dumgen.provide(many(16))], {
				concurrency: "unbounded",
			}),
		);
		await until(() => held.requests.length === 17 + 32);
		held.release();
		expect((await two).flat()).toHaveLength(32);
	});

	it("gives an action started inside another a build of its own", async () => {
		const keys = settings();
		const held = heldRequestUrl();
		const dumgen = dumgenServiceOver(held.requestUrl, keys.read);
		const outer = Effect.runPromise(
			dumgen.provide(
				Effect.gen(function* () {
					const fiber = yield* Effect.forkChild(
						Effect.all(
							Array.from({ length: 16 }, () => translate),
							{ concurrency: "unbounded" },
						),
					);
					yield* Effect.promise(() =>
						until(() => held.requests.length === 16),
					);
					keys.keys.openaiApiKey = "sk-inner";
					const inner = yield* Effect.forkChild(dumgen.provide(translate));
					yield* Effect.promise(() =>
						until(() => held.requests.length === 17),
					);
					held.release();
					yield* Fiber.join(inner);
					return yield* Fiber.join(fiber);
				}),
			),
		);
		expect(await outer).toHaveLength(16);
		expect(authorization(held.requests[16])).toBe("Bearer sk-inner");
	});

	it("runs every background run on one shared budget, renewed when a key changes", async () => {
		const keys = settings();
		const held = heldRequestUrl();
		const dumgen = dumgenServiceOver(held.requestUrl, keys.read);
		const many = (count: number) =>
			Effect.all(Array.from({ length: count }, () => translate), {
				concurrency: "unbounded",
			});
		const two = Effect.runPromise(
			Effect.all(
				[
					dumgen.provideBackground(many(10)),
					dumgen.provideBackground(many(10)),
				],
				{ concurrency: "unbounded" },
			),
		);
		await until(() => held.requests.length === 16);
		await Bun.sleep(20);
		expect(held.requests).toHaveLength(16);

		keys.keys.openaiApiKey = "sk-second";
		const third = Effect.runPromise(dumgen.provideBackground(translate));
		await until(() => held.requests.length === 17);
		expect(authorization(held.requests[16])).toBe("Bearer sk-second");
		while (held.requests.length < 21) {
			held.release();
			await Bun.sleep(1);
		}
		held.release();
		expect((await two).flat()).toHaveLength(20);
		expect(await third).toBe("The dog sleeps.");
	});

	it("lets an action begun on the old keys finish on them", async () => {
		const keys = settings();
		const held = heldRequestUrl();
		const dumgen = dumgenServiceOver(held.requestUrl, keys.read);
		const first = Effect.runPromise(dumgen.provide(translate));
		await until(() => held.requests.length === 1);
		keys.keys.openaiApiKey = "sk-second";
		const second = Effect.runPromise(dumgen.provide(translate));
		await until(() => held.requests.length === 2);
		held.release();
		expect(await Promise.all([first, second])).toEqual([
			"The dog sleeps.",
			"The dog sleeps.",
		]);
		expect(held.requests.map(authorization)).toEqual([
			"Bearer sk-first",
			"Bearer sk-second",
		]);
	});

	it("settles an action in flight at once when the runtime is disposed", async () => {
		const stub = stubRequestUrl(() => "never");
		const runtime = ManagedRuntime.make(dumgenLayerOver(stub.requestUrl));
		const exit = runtime.runPromiseExit(
			Effect.gen(function* () {
				const dumgen = yield* Dumgen;
				return yield* dumgen.provide(translate);
			}),
		);
		await stub.firstRequest;
		await runtime.dispose();
		const settled = await exit;
		expect(Exit.isFailure(settled) && Exit.hasInterrupts(settled)).toBe(true);
		expect(stub.requests).toHaveLength(1);
	});

	it("fails as DumgenUnavailable, running nothing, when it cannot be built", async () => {
		const layer = Dumgen.layer.pipe(
			Layer.provide(
				Layer.mergeAll(
					HttpTransport.layer(unreachable),
					ProviderKeys.layer(() => {
						throw new Error("the settings are gone");
					}),
				),
			),
		);
		let ran = false;
		const failure = await Effect.runPromise(
			Effect.gen(function* () {
				const dumgen = yield* Dumgen;
				return yield* Effect.flip(
					dumgen.provide(
						Effect.sync(() => {
							ran = true;
						}),
					),
				);
			}).pipe(Effect.provide(layer)),
		);
		expect(failure).toBeInstanceOf(DumgenUnavailable);
		expect(failure.message).toBe(
			"dumgen is unavailable: the settings are gone",
		);
		expect(ran).toBe(false);
	});

	it("answers from a script until it is cleared, reaching no provider", async () => {
		const dumgen = dumgenServiceOver(unreachable, () => ({
			openaiApiKey: "",
			typesafeApiKey: "",
		}));
		const run = <A>(effect: Effect.Effect<A>) => Effect.runSync(effect);
		expect(run(dumgen.missingKeys)).toEqual(["TypeSafe", "OpenAI"]);
		const script = {
			jev: {},
			luna: { translation: [{ output: "The dog sleeps." }] },
		};
		run(dumgen.testing.useScripted(script));
		expect(await Effect.runPromise(dumgen.provide(translate))).toBe(
			"The dog sleeps.",
		);
		expect(run(dumgen.testing.requests)).toEqual({
			jev: {},
			luna: { translation: 1 },
		});
		expect(run(dumgen.missingKeys)).toEqual([]);
		const tag = run(dumgen.scriptedJevTag);
		expect(tag).toHaveLength(12);
		run(dumgen.testing.useScripted(script));
		expect(run(dumgen.scriptedJevTag)).not.toBe(tag);
		expect(run(dumgen.testing.requests)).toEqual({ jev: {}, luna: {} });

		run(dumgen.testing.useScripted(null));
		expect(run(dumgen.scriptedJevTag)).toBeUndefined();
		expect(run(dumgen.testing.requests)).toBeUndefined();
		expect(run(dumgen.missingKeys)).toEqual(["TypeSafe", "OpenAI"]);
	});

	it("checks the settings' keys through its HttpTransport", async () => {
		const stub = stubRequestUrl(() => ({ status: 200, text: "" }));
		const dumgen = dumgenServiceOver(stub.requestUrl);
		expect(await Effect.runPromise(dumgen.checkKeys)).toEqual([]);
		expect(
			stub.requests.map(
				(request) => `${request.method} ${request.url} ${authorization(request)}`,
			),
		).toEqual([
			`GET ${KEY_CHECK_URLS.TypeSafe} Bearer ts-test`,
			`GET ${KEY_CHECK_URLS.OpenAI} Bearer sk-test`,
		]);
	});

	it("answers a scripted dumgen's key check from its script, reaching no provider", async () => {
		const dumgen = dumgenServiceOver(unreachable);
		Effect.runSync(dumgen.testing.useScripted({ jev: {} }));
		expect(await Effect.runPromise(dumgen.checkKeys)).toEqual([]);
		Effect.runSync(
			dumgen.testing.useScripted({
				jev: {},
				keyCheck: {
					TypeSafe: {
						body: '{"detail":{"error_type":"authentication_error"}}',
						status: 401,
					},
				},
			}),
		);
		expect(await Effect.runPromise(dumgen.checkKeys)).toEqual([
			{
				provider: "TypeSafe",
				reason: "TypeSafe rejected the API key (401 authentication_error)",
			},
		]);
	});
});

describe("Dumgen's operation spans", () => {
	const traced = <A, E>(
		requestUrl: RequestUrl,
		program: (dumgen: Dumgen["Service"]) => Effect.Effect<A, E>,
	) => {
		const trace = makeRecentTrace();
		const dumgen = dumgenServiceOver(requestUrl);
		const exit = Effect.runPromiseExit(
			Effect.withTracer(
				program(dumgen).pipe(Effect.withSpan("action", { root: true })),
				trace.tracer,
			),
		);
		return { exit, trace };
	};

	it("puts each operation's trace on its dumgen.operation span, above its calls", async () => {
		const { exit, trace } = traced(
			stubRequestUrl(() => ({
				status: 200,
				text: responsesBody("The dog sleeps."),
			})).requestUrl,
			(dumgen) => dumgen.provide(translate),
		);
		expect(Exit.isSuccess(await exit)).toBe(true);
		const { running, spans } = trace.snapshot();
		expect(running).toEqual([]);
		const action = spans.find(({ name }) => name === "action");
		const operation = spans.find(({ name }) => name === "dumgen.operation");
		const call = spans.find(({ name }) => name === "dumgen.call");
		expect(operation?.parentId).toBe(action?.spanId);
		expect(call?.parentId).toBe(operation?.spanId);
		expect(Object.fromEntries(operation?.attributes ?? [])).toMatchObject({
			"dumgen.inputTokens": 10,
			"dumgen.operation": "translate.sentence",
			"dumgen.outputTokens": 3,
			"dumgen.requests": 1,
			"dumgen.requests.failed": 0,
			"dumgen.requests.jev": 0,
			"dumgen.requests.luna": 1,
		});
		expect(operation?.attributes?.get("dumgen.durationMs")).toBeNumber();
	});

	it("counts a failed request, and keeps no answer text", async () => {
		const { exit, trace } = traced(
			stubRequestUrl(() => ({ status: 401, text: "invalid key" })).requestUrl,
			(dumgen) => dumgen.provide(translate),
		);
		expect(Exit.isFailure(await exit)).toBe(true);
		const operation = trace
			.snapshot()
			.spans.find(({ name }) => name === "dumgen.operation");
		expect(operation?.status).toBe("failed");
		expect(operation?.attributes?.get("dumgen.requests.failed")).toBe(1);
		expect(
			[...(operation?.attributes?.values() ?? [])].some(
				(value) => typeof value === "string" && value.includes("invalid key"),
			),
		).toBe(false);
	});

	it("ends an operation run under another sink as it would", async () => {
		const traces: unknown[] = [];
		const { exit, trace } = traced(
			stubRequestUrl(() => ({
				status: 200,
				text: responsesBody("The dog sleeps."),
			})).requestUrl,
			(dumgen) =>
				dumgen.provide(
					translate.pipe(
						Effect.provideService(TraceSink, (operation) => {
							traces.push(operation);
						}),
					),
				),
		);
		expect(Exit.isSuccess(await exit)).toBe(true);
		const { running, spans } = trace.snapshot();
		expect(running).toEqual([]);
		const operation = spans.find(({ name }) => name === "dumgen.operation");
		expect(operation?.attributes?.has("dumgen.requests")).toBe(false);
		expect(traces).toHaveLength(1);
	});

	it("ends every span of an interrupted operation", async () => {
		const stub = stubRequestUrl(() => "never");
		const trace = makeRecentTrace();
		const dumgen = dumgenServiceOver(stub.requestUrl);
		const fiber = Effect.runFork(
			Effect.withTracer(dumgen.provide(translate), trace.tracer),
		);
		await stub.firstRequest;
		await Effect.runPromise(Fiber.interrupt(fiber));
		const { running, spans } = trace.snapshot();
		expect(running).toEqual([]);
		const operation = spans.find(({ name }) => name === "dumgen.operation");
		expect(operation?.status).toBe("interrupted");
		expect(operation?.attributes?.get("dumgen.requests")).toBe(1);
	});
});
