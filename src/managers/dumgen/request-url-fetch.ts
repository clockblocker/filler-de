/**
 * The Promise port under `HttpTransport`: Obsidian's `requestUrl` as the
 * `fetch` both dumgen providers send through in the plugin, TypeSafe (jev)
 * and OpenAI (Luna). dumgen's transports take a Promise and an
 * `AbortSignal` (Dumgen ADR 0009), so this stays a Promise; everything
 * above it is an Effect (`http-transport.ts`).
 *
 * Why `requestUrl` and not `fetch`: `requestUrl` runs outside the renderer,
 * so CORS never applies. OpenAI documents browser use (its SDK's
 * `dangerouslyAllowBrowser`), but TypeSafe documents no CORS policy for
 * `api.typesafe.ai`, so `fetch` from `app://obsidian.md` is not known to
 * work for jev.
 *
 * What that costs: `requestUrl` takes no `AbortSignal` and has no timeout,
 * so it cannot cancel a request. This port races the request against the
 * signal dumgen passes, which already joins dumgen's deadline
 * (`timeoutMs`) and the operation's interruption. When the signal aborts,
 * the port rejects at once, so a deadline still fails the call and an
 * interrupted operation still settles promptly, as dumgen's `JevAsk` and
 * `LunaAsk` contracts require. The HTTP request itself keeps running until
 * the provider answers; that answer is dropped, the provider still bills
 * it, and dumgen's request budget has already released its permit.
 *
 * The port asks `requestUrl` not to throw on HTTP errors, so dumgen sees
 * the status and body and reports them as a `ProviderFailure`. A network
 * failure rejects, and dumgen reports that as a `ProviderFailure` too.
 */
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";

/** The part of Obsidian's `requestUrl` the port uses. */
export type RequestUrl = (
	request: RequestUrlParam,
) => PromiseLike<Pick<RequestUrlResponse, "status" | "text">>;

/**
 * One request, settled early when `signal` aborts; HTTP errors resolve
 * with their status. dumgen's `Fetch` is the `POST` half of it.
 */
export type HttpSend = (
	url: string,
	init: {
		readonly method: "GET" | "POST";
		readonly headers: Readonly<Record<string, string>>;
		readonly body?: string;
		readonly signal: AbortSignal;
	},
) => Promise<{
	readonly ok: boolean;
	readonly status: number;
	text(): Promise<string>;
}>;

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new Error("The request was aborted");
}

/**
 * One request through `requestUrl`, settled early when `signal` aborts;
 * HTTP errors resolve with their status.
 */
function sendThrough(
	requestUrl: RequestUrl,
	url: string,
	init: Parameters<HttpSend>[1],
): ReturnType<HttpSend> {
	const { signal } = init;
	if (signal.aborted) return Promise.reject(abortReason(signal));
	// oxlint-disable-next-line effecttsgo/new-promise -- dumgen's transport port is a Promise that settles when its AbortSignal aborts (Dumgen ADR 0009).
	return new Promise((resolve, reject) => {
		const onAbort = () => reject(abortReason(signal));
		signal.addEventListener("abort", onAbort, { once: true });
		// Called inside `then`, so a synchronous throw rejects too, and
		// a signal aborted in the meantime sends nothing.
		Promise.resolve()
			.then(() => {
				if (signal.aborted) throw abortReason(signal);
				return requestUrl({
					...(init.body === undefined ? {} : { body: init.body }),
					headers: { ...init.headers },
					method: init.method,
					throw: false,
					url,
				});
			})
			.then(
				(response) =>
					resolve({
						ok: response.status >= 200 && response.status < 300,
						status: response.status,
						// Obsidian decodes the body lazily, and may throw.
						text: () => Promise.resolve().then(() => response.text),
					}),
				reject,
			)
			.finally(() => signal.removeEventListener("abort", onAbort));
	});
}

export function createRequestUrlFetch(requestUrl: RequestUrl): HttpSend {
	return (url, init) => sendThrough(requestUrl, url, init);
}
