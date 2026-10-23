import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { HttpTransport } from "../../../src/managers/dumgen";
import {
	checkProviderKeys,
	KEY_CHECK_URLS,
} from "../../../src/managers/dumgen/key-check";
import { type StubAnswer, stubRequestUrl } from "./request-url-stub";

const KEYS = { openaiApiKey: "sk-test", typesafeApiKey: "ts-test" };

/** A key check over a stubbed `requestUrl` that answers by URL. */
function checkOver(
	answer: (url: string) => StubAnswer,
	keys = KEYS,
	timeoutMs?: number,
) {
	const stub = stubRequestUrl((request) => answer(request.url));
	const run = Effect.runPromise(
		checkProviderKeys({
			keys,
			...(timeoutMs === undefined ? {} : { timeoutMs }),
		}).pipe(Effect.provide(HttpTransport.layer(stub.requestUrl))),
	);
	return { requests: stub.requests, run };
}

const ok: StubAnswer = { status: 200, text: '{"data":[]}' };

describe("checkProviderKeys", () => {
	it("lists each provider's models with its key, and passes when both answer", async () => {
		const { requests, run } = checkOver(() => ok);
		expect(await run).toEqual([]);
		expect(
			requests.map(({ body, headers, method, url }) => ({
				authorization: headers?.Authorization,
				body,
				method,
				url,
			})),
		).toEqual([
			{
				authorization: "Bearer ts-test",
				body: undefined,
				method: "GET",
				url: KEY_CHECK_URLS.TypeSafe,
			},
			{
				authorization: "Bearer sk-test",
				body: undefined,
				method: "GET",
				url: KEY_CHECK_URLS.OpenAI,
			},
		]);
	});

	it("names a rejected key in one line", async () => {
		const { run } = checkOver((url) =>
			url === KEY_CHECK_URLS.OpenAI
				? {
						status: 401,
						text: '{"error":{"message":"Your API key has expired.","code":"expired_secret_key"}}',
					}
				: ok,
		);
		expect(await run).toEqual([
			{
				provider: "OpenAI",
				reason: "OpenAI rejected the API key (401 expired_secret_key)",
			},
		]);
	});

	it("fails a key with no quota, and passes a rate-limited one", async () => {
		const { run } = checkOver((url) => ({
			status: 429,
			text:
				url === KEY_CHECK_URLS.OpenAI
					? '{"error":{"code":"insufficient_quota"}}'
					: '{"detail":{"error_type":"rate_limit"}}',
		}));
		expect(await run).toEqual([
			{
				provider: "OpenAI",
				reason:
					"OpenAI has no quota left for the API key (429 insufficient_quota)",
			},
		]);
	});

	it("fails a provider it cannot reach, or that does not answer in time", async () => {
		const { run } = checkOver(
			(url) =>
				url === KEY_CHECK_URLS.OpenAI ? new Error("net::ERR_INTERNET_DISCONNECTED") : "never",
			KEYS,
			20,
		);
		expect(await run).toEqual([
			{
				provider: "TypeSafe",
				reason:
					"Could not reach TypeSafe to check the API key (it did not answer within 0.02 s)",
			},
			{
				provider: "OpenAI",
				reason:
					"Could not reach OpenAI to check the API key (net::ERR_INTERNET_DISCONNECTED)",
			},
		]);
	});

	it("fails a missing key without asking its provider", async () => {
		const { requests, run } = checkOver(() => ok, {
			openaiApiKey: " ",
			typesafeApiKey: "ts-test",
		});
		expect(await run).toEqual([
			{ provider: "OpenAI", reason: "Textfresser has no OpenAI API key" },
		]);
		expect(requests.map(({ url }) => url)).toEqual([KEY_CHECK_URLS.TypeSafe]);
	});
});
