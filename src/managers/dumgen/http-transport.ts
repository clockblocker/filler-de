/**
 * The plugin's HTTP: Obsidian's `requestUrl`, behind the Promise port
 * dumgen's transports take (`send`, `request-url-fetch.ts`) and as an
 * Effect for everything else (`request`), such as the provider key check.
 * Interrupting a `request` aborts its signal, and the port then settles at
 * once, so a request in flight when the plugin unloads stops with it.
 */
import { Context, Data, Effect, Layer } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import {
	createRequestUrlFetch,
	type HttpSend,
	type RequestUrl,
} from "./request-url-fetch";

/** A request that brought no answer back: the network failed, or it was aborted. */
export class HttpTransportError extends Data.TaggedError("HttpTransportError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

/** An answer and its body; an HTTP error is an answer too. */
export type HttpAnswer = { readonly status: number; readonly body: string };

export type HttpRequest = Omit<Parameters<HttpSend>[1], "signal">;

export class HttpTransport extends Context.Service<
	HttpTransport,
	{
		/** The Promise port dumgen's jev and Luna transports send through. */
		readonly send: HttpSend;
		readonly request: (
			url: string,
			init: HttpRequest,
		) => Effect.Effect<HttpAnswer, HttpTransportError>;
	}
>()("textfresser/managers/dumgen/HttpTransport") {
	/** The transport over `send`, such as a test's scripted one. */
	static readonly over = (send: HttpSend): HttpTransport["Service"] =>
		HttpTransport.of({
			request: (url, init) =>
				Effect.tryPromise({
					catch: (cause) =>
						new HttpTransportError({
							cause,
							message: getErrorMessage(cause),
						}),
					try: (signal) =>
						send(url, { ...init, signal }).then((response) =>
							response.text().then((body) => ({
								body,
								status: response.status,
							})),
						),
				}),
			send,
		});

	/** Over Obsidian's `requestUrl`. */
	static readonly layer = (requestUrl: RequestUrl) =>
		Layer.succeed(
			HttpTransport,
			HttpTransport.over(createRequestUrlFetch(requestUrl)),
		);
}
