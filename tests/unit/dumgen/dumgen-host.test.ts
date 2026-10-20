import { describe, expect, it } from "bun:test";
import { ProviderFailure } from "dumgen";
import * as Effect from "effect/Effect";
import {
	createRequestUrlFetch,
	DumgenHost,
	type DumgenProviderKeys,
} from "../../../src/managers/dumgen";
import {
	responsesBody,
	type StubAnswer,
	stubRequestUrl,
} from "./request-url-stub";

function hostOver(answer: () => StubAnswer) {
	const stub = stubRequestUrl(answer);
	const settings: { -readonly [K in keyof DumgenProviderKeys]: string } = {
		openaiApiKey: "sk-first",
		typesafeApiKey: "ts-first",
	};
	let reads = 0;
	const host = new DumgenHost({
		fetch: createRequestUrlFetch(stub.requestUrl),
		keys: () => {
			reads++;
			return settings;
		},
	});
	return { ...stub, host, reads: () => reads, settings };
}

const translate = (host: DumgenHost) =>
	host.get().translate.sentence({
		into: "en",
		language: "de",
		sentence: "Der Hund schläft.",
	});

describe("DumgenHost", () => {
	it("builds nothing until first use, then keeps one instance", () => {
		const { host, reads } = hostOver(() => "never");
		expect(reads()).toBe(0);
		const first = host.get();
		expect(host.get()).toBe(first);
		expect(reads()).toBe(2);
	});

	it("rebuilds when a key changes, and not for surrounding whitespace", async () => {
		const { host, requests, settings } = hostOver(() => ({
			status: 200,
			text: responsesBody("The dog sleeps."),
		}));
		const first = host.get();
		settings.typesafeApiKey = " ts-first ";
		expect(host.get()).toBe(first);
		settings.openaiApiKey = "sk-second";
		const second = host.get();
		expect(second).not.toBe(first);
		await Effect.runPromise(translate(host));
		expect(requests[0]?.headers?.Authorization).toBe("Bearer sk-second");
	});

	it("aborts calls in flight on dispose and refuses use afterwards", async () => {
		const { host, requests } = hostOver(() => "never");
		const pending = Effect.runPromise(Effect.flip(translate(host)));
		while (requests.length === 0) await Bun.sleep(1);
		host.dispose();
		const failure = await pending;
		expect(failure).toBeInstanceOf(ProviderFailure);
		expect(failure.message).toContain("The plugin unloaded");
		expect(() => host.get()).toThrow("disposed");
		host.dispose();
	});
});
