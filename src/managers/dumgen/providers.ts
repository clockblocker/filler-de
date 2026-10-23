/**
 * A dumgen instance with its two providers, TypeSafe (jev) and OpenAI
 * (Luna), over whatever `Fetch` the host injects: `requestUrl` in the
 * plugin, the runtime's `fetch` in provider acceptance.
 *
 * Each provider needs only its own key. Without one, its transport fails
 * every call, so dumgen reports a `ProviderFailure` that names the missing
 * setting, and the operations that never reach that provider still work:
 * `translate.sentence` needs only the OpenAI key, `segment.inUnits` and
 * `language.detect` only the TypeSafe key. The missing transport is a
 * `fromAsk` over a refusing ask, as tf-demo's `deploymentDumgen` does,
 * because `typeSafe` and `openAI` refuse an empty key when they are built.
 */
import { JevTransport, LunaTransport } from "dumgen";
import type * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import { type Dumgen, type DumgenOptions, dumgenOver } from "./dumgen-over";

/** The `fetch` subset dumgen's TypeSafe and OpenAI transports send through. */
export type DumgenFetch = NonNullable<
	Parameters<typeof JevTransport.typeSafe>[0]["fetch"]
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

/** The jev and Luna transports `DumgenLive` builds over, from the keys. */
export function dumgenTransports(options: DumgenProviderOptions): {
	readonly jev: Layer.Layer<JevTransport>;
	readonly luna: Layer.Layer<LunaTransport>;
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
			? JevTransport.typeSafe({ apiKey: typesafeApiKey, ...transport })
			: JevTransport.fromAsk(missingKey("TypeSafe")),
		luna: openaiApiKey
			? LunaTransport.openAI({ apiKey: openaiApiKey, ...transport })
			: LunaTransport.fromAsk(missingKey("OpenAI")),
	};
}

/**
 * dumgen over the providers' transports, built in `scope`; `extra` adds
 * `DumgenLive`'s other options, such as `onOperation`.
 */
export function buildDumgen(
	options: DumgenProviderOptions,
	scope?: Scope.Scope,
	extra: Omit<DumgenOptions, "jev" | "luna"> = {},
): Dumgen {
	return dumgenOver({ ...extra, ...dumgenTransports(options) }, scope);
}
