/**
 * A dumgen instance with its two providers, TypeSafe (jev) and OpenAI
 * (Luna), over whatever `Fetch` the host injects: `requestUrl` in the
 * plugin, the runtime's `fetch` in provider acceptance.
 *
 * Each provider needs only its own key. Without one, its transport fails
 * every call, so dumgen reports a `ProviderFailure` that names the missing
 * setting, and the operations that never reach that provider still work:
 * `translate.sentence` needs only the OpenAI key, `segment.inUnits` and
 * `language.detect` only the TypeSafe key.
 */
import {
	createDumgen,
	createOpenAILuna,
	createTypeSafeAsk,
	type Dumgen,
	type JevAsk,
	type LunaAsk,
} from "dumgen";

/** The `fetch` subset dumgen's TypeSafe and OpenAI transports send through. */
export type DumgenFetch = NonNullable<
	Parameters<typeof createTypeSafeAsk>[0]["fetch"]
>;

export type DumgenProviderKeys = {
	readonly typesafeApiKey: string;
	readonly openaiApiKey: string;
};

export type DumgenProviderOptions = DumgenProviderKeys & {
	readonly fetch: DumgenFetch;
	/** Each request's deadline; dumgen's 120 seconds unless given. */
	readonly timeoutMs?: number;
};

const missingKey = (provider: string) => async (): Promise<never> => {
	throw new Error(
		`Textfresser has no ${provider} API key. Add one in the plugin's settings.`,
	);
};

export function createDumgenProviders(options: DumgenProviderOptions): {
	readonly jev: JevAsk;
	readonly luna: LunaAsk;
} {
	const transport = {
		fetch: options.fetch,
		...(options.timeoutMs === undefined
			? {}
			: { timeoutMs: options.timeoutMs }),
	};
	const typesafeApiKey = options.typesafeApiKey.trim();
	const openaiApiKey = options.openaiApiKey.trim();
	return {
		jev: typesafeApiKey
			? createTypeSafeAsk({ apiKey: typesafeApiKey, ...transport })
			: missingKey("TypeSafe"),
		luna: openaiApiKey
			? createOpenAILuna({ apiKey: openaiApiKey, ...transport })
			: missingKey("OpenAI"),
	};
}

export function buildDumgen(options: DumgenProviderOptions): Dumgen {
	return createDumgen(createDumgenProviders(options));
}
