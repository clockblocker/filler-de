import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod/v3";

const MODEL = "gemini-2.5-flash-lite";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export type ApiCallResult<T> = {
	parsed: T | null;
	raw: string;
	error?: string;
	durationMs: number;
};

export async function callGemini<T extends z.ZodTypeAny>(opts: {
	apiKey: string;
	systemPrompt: string;
	userInput: string;
	schema: T;
}): Promise<ApiCallResult<z.infer<T>>> {
	const client = new OpenAI({
		apiKey: opts.apiKey,
		baseURL: BASE_URL,
	});

	const start = performance.now();
	try {
		const completion = await client.chat.completions.parse({
			messages: [
				{ content: opts.systemPrompt, role: "system" },
				{ content: opts.userInput, role: "user" },
			],
			model: MODEL,
			response_format: zodResponseFormat(
				opts.schema as unknown as Parameters<typeof zodResponseFormat>[0],
				"data",
			),
			temperature: 0,
			top_p: 0.95,
		});

		const durationMs = Math.round(performance.now() - start);
		const raw = JSON.stringify(completion.choices?.[0]?.message ?? {});
		const parsed = completion.choices?.[0]?.message?.parsed ?? null;

		return { durationMs, parsed, raw };
	} catch (err) {
		const durationMs = Math.round(performance.now() - start);
		const error = err instanceof Error ? err.message : String(err);
		return { durationMs, error, parsed: null, raw: "" };
	}
}
