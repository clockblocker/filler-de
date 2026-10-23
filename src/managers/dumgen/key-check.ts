/**
 * A check of the provider keys before work that needs them (#146): one
 * `GET /v1/models` per provider over `HttpTransport`, which both the
 * OpenAI and the TypeSafe API authenticate and neither bills. A key the provider rejects, or a
 * provider that cannot be reached, is a failure named in one line
 * (`providerAnswerLine`); a rate limit is not, since it shows the key was
 * accepted.
 */
import { Effect, Option } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import { HttpTransport } from "../obsidian/host/http-transport";
import {
	errorCode,
	type ProviderName,
	providerAnswerLine,
} from "./provider-failure";
import type { DumgenProviderKeys } from "./providers";

export type KeyCheckFailure = {
	readonly provider: ProviderName;
	/** `OpenAI rejected the API key (401 expired_secret_key)` */
	readonly reason: string;
};

export const KEY_CHECK_URLS: Readonly<Record<ProviderName, string>> = {
	OpenAI: "https://api.openai.com/v1/models",
	TypeSafe: "https://api.typesafe.ai/v1/models",
};

const DEFAULT_TIMEOUT_MS = 15_000;

export type KeyCheckOptions = {
	readonly keys: DumgenProviderKeys;
	/** Each request's deadline; 15 seconds unless given. */
	readonly timeoutMs?: number;
};

const checkOne = Effect.fnUntraced(function* (
	provider: ProviderName,
	apiKey: string,
	timeoutMs: number,
): Effect.fn.Return<KeyCheckFailure | undefined, never, HttpTransport> {
	if (!apiKey)
		return {
			provider,
			reason: `Textfresser has no ${provider} API key`,
		};
	const http = yield* HttpTransport;
	const answered = yield* http
		.request(KEY_CHECK_URLS[provider], {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			method: "GET",
		})
		.pipe(
			Effect.timeoutOption(timeoutMs),
			Effect.map(
				Option.match({
					onNone: () => ({
						_tag: "Unreachable" as const,
						why: `it did not answer within ${timeoutMs / 1000} s`,
					}),
					onSome: (answer) => ({
						_tag: "Answered" as const,
						...answer,
					}),
				}),
			),
			Effect.catchTag("HttpTransportError", (error) =>
				Effect.succeed({
					_tag: "Unreachable" as const,
					why: getErrorMessage(error.cause),
				}),
			),
		);
	if (answered._tag === "Unreachable")
		return {
			provider,
			reason: `Could not reach ${provider} to check the API key (${answered.why})`,
		};
	const { body, status } = answered;
	if (status >= 200 && status < 300) return undefined;
	// A rate limit means the key itself was accepted; no quota means not.
	if (status === 429 && errorCode(body) !== "insufficient_quota")
		return undefined;
	return { provider, reason: providerAnswerLine(provider, status, body) };
});

/**
 * Checks both keys at once; answers the failures, TypeSafe's first, and
 * none when both keys work.
 */
export const checkProviderKeys = Effect.fn("checkProviderKeys")(function* (
	options: KeyCheckOptions,
): Effect.fn.Return<readonly KeyCheckFailure[], never, HttpTransport> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const results = yield* Effect.all(
		[
			checkOne("TypeSafe", options.keys.typesafeApiKey.trim(), timeoutMs),
			checkOne("OpenAI", options.keys.openaiApiKey.trim(), timeoutMs),
		],
		{ concurrency: "unbounded" },
	);
	return results.filter((result) => result !== undefined);
});
