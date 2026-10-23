/**
 * The plugin's one dumgen instance. It is built on first use from the
 * provider keys in the settings, rebuilt when either key changes, and
 * disposed on unload.
 *
 * `get()` returns the instance; its operations are Effects the caller runs.
 * Disposing aborts every call still in flight, the replaced instances'
 * included, and makes `get()` throw. dumgen reports such a call as a
 * `ProviderFailure` reading "… connection failed: Cancelled because the
 * plugin unloaded", since it tells apart only its own aborts. A rebuilt
 * instance gets a fresh request budget, and the old instance's in-flight
 * calls run on. Every instance is one `DumgenLive` build (`dumgenOver`) in
 * the host's scope, which `dispose()` closes.
 */
import { sha256Hex } from "@textfresser/lemma-note-codec";
import { JevTransport, LunaTransport } from "dumgen";
import { Effect, Exit, Scope } from "effect";
import { type Dumgen, dumgenOver } from "./dumgen-over";
import {
	checkProviderKeys,
	KEY_CHECK_URLS,
	type KeyCheckFailure,
	type KeyCheckGet,
} from "./key-check";
import type { ProviderName } from "./provider-failure";
import {
	buildDumgen,
	type DumgenFetch,
	type DumgenProviderKeys,
} from "./providers";
import { createScriptedJev, type ScriptedJevAnswers } from "./scripted-jev";
import { createScriptedLuna, type ScriptedLunaAnswers } from "./scripted-luna";

/** How a scripted provider answers the key check: 200 with no body unless given. */
export type ScriptedKeyCheck = Partial<
	Record<ProviderName, { readonly status: number; readonly body?: string }>
>;

/**
 * A provider-free dumgen's script: jev's answers and, optionally, Luna's,
 * and how each provider answers the key check.
 */
export type ScriptedDumgen = {
	readonly jev: ScriptedJevAnswers;
	readonly luna?: ScriptedLunaAnswers;
	readonly keyCheck?: ScriptedKeyCheck;
};

/** How many requests a scripted dumgen's providers received, by stage. */
export type ScriptedDumgenRequests = {
	readonly jev: Readonly<Record<string, number>>;
	readonly luna: Readonly<Record<string, number>>;
};

export type DumgenHostOptions = {
	/** Read on every `get()`, so a key change takes effect on the next call. */
	readonly keys: () => DumgenProviderKeys;
	readonly fetch: DumgenFetch;
	/** The key check's GET; without one, `checkKeys()` checks nothing. */
	readonly get?: KeyCheckGet;
	readonly timeoutMs?: number;
};

export class DumgenHost {
	private readonly lifetime = new AbortController();
	/** Holds every instance's build; closed on dispose. */
	private readonly scope = Scope.makeUnsafe();
	private current:
		| { readonly keys: DumgenProviderKeys; readonly dumgen: Dumgen }
		| undefined;
	private scripted:
		| {
				readonly dumgen: Dumgen;
				readonly tag: string;
				readonly requests: () => ScriptedDumgenRequests;
				readonly keyCheck: ScriptedKeyCheck;
		  }
		| undefined;

	constructor(private readonly options: DumgenHostOptions) {}

	get(): Dumgen {
		if (this.lifetime.signal.aborted)
			throw new Error("dumgen was disposed when the plugin unloaded");
		if (this.scripted) return this.scripted.dumgen;
		const read = this.options.keys();
		const keys = {
			openaiApiKey: read.openaiApiKey.trim(),
			typesafeApiKey: read.typesafeApiKey.trim(),
		};
		const current = this.current;
		if (
			current &&
			current.keys.openaiApiKey === keys.openaiApiKey &&
			current.keys.typesafeApiKey === keys.typesafeApiKey
		)
			return current.dumgen;
		const dumgen = buildDumgen(
			{
				...keys,
				fetch: this.fetch,
				...(this.options.timeoutMs === undefined
					? {}
					: { timeoutMs: this.options.timeoutMs }),
			},
			this.scope,
		);
		this.current = { dumgen, keys };
		return dumgen;
	}

	/**
	 * Desktop E2E only: until cleared with `null`, `get()` returns a dumgen
	 * whose jev answers from `answers` (see `createScriptedJev`) and whose
	 * Luna refuses every call, so no provider is ever reached.
	 */
	useScriptedJevForTesting(answers: ScriptedJevAnswers | null): void {
		this.useScriptedDumgenForTesting(
			answers === null ? null : { jev: answers },
		);
	}

	/**
	 * Desktop E2E and in-process tests: until cleared with `null`, `get()`
	 * returns a dumgen whose jev and Luna answer from `script` (see
	 * `createScriptedJev` and `createScriptedLuna`); Luna refuses every
	 * request its script does not answer.
	 */
	useScriptedDumgenForTesting(script: ScriptedDumgen | null): void {
		if (script === null) {
			this.scripted = undefined;
			return;
		}
		const jev = createScriptedJev(script.jev);
		const luna = createScriptedLuna(script.luna ?? {});
		this.scripted = {
			dumgen: dumgenOver(
				{
					jev: JevTransport.fromAsk(jev.ask),
					luna: LunaTransport.fromAsk(luna.ask),
				},
				this.scope,
			),
			keyCheck: script.keyCheck ?? {},
			requests: () => ({ jev: jev.requests(), luna: luna.requests() }),
			tag: sha256Hex(
				JSON.stringify([script.jev, crypto.randomUUID()]),
			).slice(0, 12),
		};
	}

	/** The scripted dumgen's requests so far; undefined with the real providers. */
	scriptedRequests(): ScriptedDumgenRequests | undefined {
		return this.scripted?.requests();
	}

	/**
	 * The providers whose key the settings lack, by name; none while a
	 * scripted dumgen stands in for them.
	 */
	missingKeys(): readonly string[] {
		if (this.scripted) return [];
		const keys = this.options.keys();
		return [
			...(keys.typesafeApiKey.trim() ? [] : ["TypeSafe"]),
			...(keys.openaiApiKey.trim() ? [] : ["OpenAI"]),
		];
	}

	/**
	 * Names the scripted jev in use, so its segmentations are cached apart
	 * from real ones and from every earlier script, the same one included:
	 * each scenario starts with a cold cache. Undefined with the real
	 * providers.
	 */
	scriptedJevTag(): string | undefined {
		return this.scripted?.tag;
	}

	/**
	 * Checks the keys in the settings with each provider (`key-check.ts`),
	 * answering what failed; a scripted dumgen answers from its script's
	 * `keyCheck`, so no provider is reached.
	 */
	checkKeys(): Effect.Effect<readonly KeyCheckFailure[]> {
		const { scripted } = this;
		if (scripted) {
			const answer: KeyCheckGet = async (url) => {
				const provider =
					url === KEY_CHECK_URLS.OpenAI ? "OpenAI" : "TypeSafe";
				const scriptedAnswer = scripted.keyCheck[provider];
				return {
					status: scriptedAnswer?.status ?? 200,
					text: async () => scriptedAnswer?.body ?? "",
				};
			};
			return checkProviderKeys({
				get: answer,
				keys: { openaiApiKey: "scripted", typesafeApiKey: "scripted" },
			});
		}
		const { get } = this.options;
		if (get === undefined) return Effect.succeed([]);
		const { signal } = this.lifetime;
		return checkProviderKeys({
			get: (url, init) =>
				get(url, {
					...init,
					signal: AbortSignal.any([init.signal, signal]),
				}),
			keys: this.options.keys(),
		});
	}

	/**
	 * Aborts every call in flight and releases every build; `get()` throws
	 * afterwards. Idempotent.
	 */
	dispose(): void {
		this.current = undefined;
		this.scripted = undefined;
		this.lifetime.abort(new Error("Cancelled because the plugin unloaded"));
		Effect.runSync(Scope.close(this.scope, Exit.void));
	}

	private readonly fetch: DumgenFetch = (url, init) =>
		this.options.fetch(url, {
			...init,
			signal: AbortSignal.any([init.signal, this.lifetime.signal]),
		});
}
