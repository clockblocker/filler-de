import { describe, expect, it } from "bun:test";
import { type Dumgen, ProviderFailure } from "dumgen";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import {
	buildDumgen,
	createDumgenProviders,
	createRequestUrlFetch,
} from "../../../src/managers/dumgen";
import {
	jevBody,
	parsedBody,
	responsesBody,
	type StubAnswer,
	stubRequestUrl,
} from "./request-url-stub";

const keys = { openaiApiKey: "sk-openai", typesafeApiKey: "ts-typesafe" };

function dumgenOver(
	answer: () => StubAnswer,
	options: { readonly timeoutMs?: number } = {},
) {
	const stub = stubRequestUrl(answer);
	const dumgen = buildDumgen({
		...keys,
		fetch: createRequestUrlFetch(stub.requestUrl),
		...options,
	});
	return { ...stub, dumgen };
}

const translate = (dumgen: Dumgen) =>
	dumgen.translate.sentence({
		into: "en",
		language: "de",
		sentence: "Der Hund schläft.",
	});

const detect = (dumgen: Dumgen) =>
	dumgen.language.detect({
		paragraphs: [{ sentences: ["Der Hund schläft im Garten."] }],
	});

const failureOf = <A, E>(effect: Effect.Effect<A, E>) =>
	Effect.runPromise(Effect.flip(effect));

describe("TypeSafe (jev) over requestUrl", () => {
	it("posts the System One request with the key as a bearer token", async () => {
		const { requestUrl, requests } = stubRequestUrl(() => ({
			status: 200,
			text: jevBody,
		}));
		const { jev } = createDumgenProviders({
			...keys,
			fetch: createRequestUrlFetch(requestUrl),
		});
		const response = await jev(
			{
				model: "jev-1.13.0",
				questions: { q0: { kind: "Choice", options: ["German"] } },
				state: { sentence: "Der Hund schläft." },
			} as unknown as Parameters<typeof jev>[0],
			{ signal: new AbortController().signal, stage: "detect" },
		);
		expect(response.model).toBe("jev-1.13.0");
		expect(requests).toHaveLength(1);
		const [request] = requests;
		expect(request?.url).toBe("https://api.typesafe.ai/v1/systemone");
		expect(request?.method).toBe("POST");
		expect(request?.throw).toBe(false);
		expect(request?.headers).toEqual({
			Accept: "application/json",
			Authorization: "Bearer ts-typesafe",
			"Content-Type": "application/json",
		});
		expect(parsedBody(request)).toEqual({
			model: "jev-1.13.0",
			questions: { q0: { kind: "Choice", options: ["German"] } },
			state: { sentence: "Der Hund schläft." },
		});
	});

	it("names the pinned jev model in what dumgen sends", async () => {
		const { dumgen, requests } = dumgenOver(() => ({
			status: 500,
			text: "down",
		}));
		await failureOf(detect(dumgen));
		expect(parsedBody(requests[0])).toMatchObject({ model: "jev-1.13.0" });
	});

	it("maps a refused request to a ProviderFailure with its status", async () => {
		const { dumgen } = dumgenOver(() => ({
			status: 429,
			text: "rate limited",
		}));
		const failure = await failureOf(detect(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe("TypeSafe answered 429: rate limited");
		expect((failure as ProviderFailure).cause).toMatchObject({
			status: 429,
		});
	});

	it("maps a network failure to a ProviderFailure", async () => {
		const { dumgen } = dumgenOver(() => new Error("net::ERR_INTERNET"));
		const failure = await failureOf(detect(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe(
			"TypeSafe connection failed: net::ERR_INTERNET",
		);
	});

	it("fails at its deadline although requestUrl never settles", async () => {
		const { dumgen } = dumgenOver(() => "never", { timeoutMs: 20 });
		const failure = await failureOf(detect(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe("TypeSafe did not answer within 20 ms");
	});
});

describe("OpenAI (Luna) over requestUrl", () => {
	it("posts a Responses request and reads its output", async () => {
		const { dumgen, requests } = dumgenOver(() => ({
			status: 200,
			text: responsesBody("The dog sleeps."),
		}));
		expect(await Effect.runPromise(translate(dumgen))).toBe(
			"The dog sleeps.",
		);
		expect(requests).toHaveLength(1);
		const [request] = requests;
		expect(request?.url).toBe("https://api.openai.com/v1/responses");
		expect(request?.method).toBe("POST");
		expect(request?.throw).toBe(false);
		expect(request?.headers).toEqual({
			Authorization: "Bearer sk-openai",
			"Content-Type": "application/json",
		});
		const body = parsedBody(request) as {
			model: string;
			store: boolean;
			input: { role: string; content: string }[];
		};
		expect(body.model).toBe("gpt-5.6-luna");
		expect(body.store).toBe(false);
		expect(body.input.map(({ role }) => role)).toEqual(["system", "user"]);
		expect(JSON.parse(body.input[1]?.content ?? "")).toMatchObject({
			language: "en",
			sentence: "Der Hund schläft.",
		});
	});

	it("maps a refused request to a ProviderFailure", async () => {
		const { dumgen } = dumgenOver(() => ({
			status: 401,
			text: "invalid key",
		}));
		const failure = await failureOf(translate(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe("OpenAI answered 401: invalid key");
	});

	it("maps a network failure to a ProviderFailure", async () => {
		const { dumgen } = dumgenOver(() => new Error("socket hang up"));
		const failure = await failureOf(translate(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe("OpenAI connection failed: socket hang up");
	});

	it("fails at its deadline although requestUrl never settles", async () => {
		const { dumgen } = dumgenOver(() => "never", { timeoutMs: 20 });
		const failure = await failureOf(translate(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe("OpenAI did not answer within 20 ms");
	});

	it("settles an interrupted call without waiting for requestUrl", async () => {
		const { dumgen, firstRequest, requests } = dumgenOver(() => "never");
		const fiber = Effect.runFork(translate(dumgen));
		await firstRequest;
		await Effect.runPromise(Fiber.interrupt(fiber));
		expect(requests).toHaveLength(1);
	});
});

describe("the requestUrl Fetch", () => {
	it("sends nothing once its signal has aborted", async () => {
		const { requestUrl, requests } = stubRequestUrl(() => ({
			status: 200,
			text: "{}",
		}));
		const controller = new AbortController();
		controller.abort(new Error("gone"));
		const send = createRequestUrlFetch(requestUrl);
		await expect(
			send("https://example.test", {
				body: "{}",
				headers: {},
				method: "POST",
				signal: controller.signal,
			}),
		).rejects.toThrow("gone");
		expect(requests).toHaveLength(0);
	});

	it("reports any 2xx as ok and keeps an error body readable", async () => {
		const send = createRequestUrlFetch(
			stubRequestUrl(({ url }) => ({
				status: url.endsWith("created") ? 201 : 503,
				text: "body",
			})).requestUrl,
		);
		const init = {
			body: "{}",
			headers: {},
			method: "POST" as const,
			signal: new AbortController().signal,
		};
		const created = await send("https://example.test/created", init);
		expect(created.ok).toBe(true);
		const failed = await send("https://example.test/failed", init);
		expect(failed).toMatchObject({ ok: false, status: 503 });
		expect(await failed.text()).toBe("body");
	});
});

describe("missing provider keys", () => {
	it("fails only the provider whose key is missing", async () => {
		const { requestUrl, requests } = stubRequestUrl(() => ({
			status: 200,
			text: responsesBody("The dog sleeps."),
		}));
		const dumgen = buildDumgen({
			fetch: createRequestUrlFetch(requestUrl),
			openaiApiKey: "sk-openai",
			typesafeApiKey: "  ",
		});
		expect(await Effect.runPromise(translate(dumgen))).toBe(
			"The dog sleeps.",
		);
		const failure = await failureOf(detect(dumgen));
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toBe(
			"Textfresser has no TypeSafe API key. Add one in the plugin's settings.",
		);
		expect(requests).toHaveLength(1);
	});

	it("names the OpenAI key when it is the missing one", async () => {
		const { requestUrl, requests } = stubRequestUrl(() => "never");
		const dumgen = buildDumgen({
			fetch: createRequestUrlFetch(requestUrl),
			openaiApiKey: "",
			typesafeApiKey: "ts-typesafe",
		});
		const failure = await failureOf(translate(dumgen));
		expect(failure.message).toBe(
			"Textfresser has no OpenAI API key. Add one in the plugin's settings.",
		);
		expect(requests).toHaveLength(0);
	});
});
