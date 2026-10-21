/**
 * A check of the provider keys before work that needs them (#146): one
 * `GET /v1/models` per provider, which both the OpenAI and the TypeSafe
 * API authenticate and neither bills. A key the provider rejects, or a
 * provider that cannot be reached, is a failure named in one line
 * (`providerAnswerLine`); a rate limit is not, since it shows the key was
 * accepted.
 */
import { Effect, Option } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import {
	errorCode,
	type ProviderName,
	providerAnswerLine,
} from "./provider-failure";
import type { DumgenProviderKeys } from "./providers";

/** A GET over the plugin's transport: `requestUrl`, through `createRequestUrlGet`. */
export type KeyCheckGet = (
	url: string,
	init: {
		readonly headers: Readonly<Record<string, string>>;
		readonly signal: AbortSignal;
	},
) => Promise<{ readonly status: number; text(): Promise<string> }>;

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
	readonly get: KeyCheckGet;
	readonly keys: DumgenProviderKeys;
	/** Each request's deadline; 15 seconds unless given. */
	readonly timeoutMs?: number;
};

const checkOne = Effect.fnUntraced(function* (
	get: KeyCheckGet,
	provider: ProviderName,
	apiKey: string,
	timeoutMs: number,
): Effect.fn.Return<KeyCheckFailure | undefined> {
	if (!apiKey)
		return {
			provider,
			reason: `Textfresser has no ${provider} API key`,
		};
	const answered = yield* Effect.tryPromise({
		catch: (cause) => cause,
		try: async (signal) => {
			const response = await get(KEY_CHECK_URLS[provider], {
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				signal,
			});
			return { body: await response.text(), status: response.status };
		},
	}).pipe(
		Effect.timeoutOption(timeoutMs),
		Effect.map(
			Option.match({
				onNone: () => ({
					_tag: "Unreachable" as const,
					why: `it did not answer within ${timeoutMs / 1000} s`,
				}),
				onSome: (answer) => ({ _tag: "Answered" as const, ...answer }),
			}),
		),
		Effect.catch((cause) =>
			Effect.succeed({
				_tag: "Unreachable" as const,
				why: getErrorMessage(cause),
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
): Effect.fn.Return<readonly KeyCheckFailure[]> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const results = yield* Effect.all(
		[
			checkOne(
				options.get,
				"TypeSafe",
				options.keys.typesafeApiKey.trim(),
				timeoutMs,
			),
			checkOne(
				options.get,
				"OpenAI",
				options.keys.openaiApiKey.trim(),
				timeoutMs,
			),
		],
		{ concurrency: "unbounded" },
	);
	return results.filter((result) => result !== undefined);
});
