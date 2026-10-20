import type { RequestUrlParam } from "obsidian";
import type { RequestUrl } from "../../../src/managers/dumgen";

export type StubAnswer =
	| { readonly status: number; readonly text: string }
	| Error
	| "never";

/**
 * A stubbed Obsidian `requestUrl` that records each request and answers it
 * with `answer`: a status and body, a rejection, or `"never"`, a request
 * that never settles, as `requestUrl` does for a hung connection.
 */
export function stubRequestUrl(
	answer: (request: RequestUrlParam) => StubAnswer,
) {
	const requests: RequestUrlParam[] = [];
	const requestUrl: RequestUrl = (request) => {
		requests.push(request);
		const reply = answer(request);
		if (reply === "never") return new Promise(() => {});
		if (reply instanceof Error) return Promise.reject(reply);
		return Promise.resolve(reply);
	};
	return { requests, requestUrl };
}

export const parsedBody = (request: RequestUrlParam | undefined): unknown =>
	JSON.parse(String(request?.body));

/** A completed OpenAI Responses body whose JSON output holds `value`. */
export const responsesBody = (value: unknown) =>
	JSON.stringify({
		model: "gpt-5.6-luna",
		output: [
			{
				content: [
					{ text: JSON.stringify({ value }), type: "output_text" },
				],
			},
		],
		status: "completed",
		usage: { input_tokens: 10, output_tokens: 3 },
	});

export const jevBody = JSON.stringify({
	answers: { q0: "German" },
	model: "jev-1.13.0",
	usage: { input_tokens: 5, output_tokens: 1 },
});
