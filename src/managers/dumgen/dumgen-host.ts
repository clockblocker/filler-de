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
 * calls run on.
 */
import type { Dumgen } from "dumgen";
import {
	buildDumgen,
	type DumgenFetch,
	type DumgenProviderKeys,
} from "./providers";

export type DumgenHostOptions = {
	/** Read on every `get()`, so a key change takes effect on the next call. */
	readonly keys: () => DumgenProviderKeys;
	readonly fetch: DumgenFetch;
	readonly timeoutMs?: number;
};

export class DumgenHost {
	private readonly lifetime = new AbortController();
	private current:
		| { readonly keys: DumgenProviderKeys; readonly dumgen: Dumgen }
		| undefined;

	constructor(private readonly options: DumgenHostOptions) {}

	get(): Dumgen {
		if (this.lifetime.signal.aborted)
			throw new Error("dumgen was disposed when the plugin unloaded");
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
		const dumgen = buildDumgen({
			...keys,
			fetch: this.fetch,
			...(this.options.timeoutMs === undefined
				? {}
				: { timeoutMs: this.options.timeoutMs }),
		});
		this.current = { dumgen, keys };
		return dumgen;
	}

	/** Aborts every call in flight; `get()` throws afterwards. Idempotent. */
	dispose(): void {
		this.current = undefined;
		this.lifetime.abort(new Error("Cancelled because the plugin unloaded"));
	}

	private readonly fetch: DumgenFetch = (url, init) =>
		this.options.fetch(url, {
			...init,
			signal: AbortSignal.any([init.signal, this.lifetime.signal]),
		});
}
