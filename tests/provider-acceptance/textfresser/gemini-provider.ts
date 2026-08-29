import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "@textfresser/lexical-generation-next";
import { err, ok } from "neverthrow";
import OpenAI from "openai";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_OPENAI_BASE_URL =
	"https://generativelanguage.googleapis.com/v1beta/openai/";

interface GeminiProviderOptions {
	readonly apiKey: string;
	readonly model?: string;
}

export function createGeminiStructuredFetch(
	options: GeminiProviderOptions,
): StructuredFetchFn {
	const model = options.model ?? DEFAULT_GEMINI_MODEL;
	const client = new OpenAI({
		apiKey: options.apiKey,
		baseURL: GEMINI_OPENAI_BASE_URL,
		maxRetries: 0,
		timeout: 45_000,
	});

	return async ({ requestLabel, systemPrompt, userInput }) => {
		try {
			const completion = await client.chat.completions.create({
				messages: [
					{ content: systemPrompt.replace(/^\t+/gm, ""), role: "system" },
					{ content: userInput, role: "user" },
				],
				model,
				response_format: { type: "json_object" },
				temperature: 0,
				top_p: 0.95,
			});
			const content = completion.choices[0]?.message.content;
			if (!content) {
				return err(
					lexicalGenerationError(
						LexicalGenerationFailureKind.InvalidModelOutput,
						`Gemini returned no JSON content for ${requestLabel}`,
						{ model, requestLabel },
					),
				);
			}

			return ok(JSON.parse(content) as unknown);
		} catch (error) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.FetchFailed,
					`Gemini request failed for ${requestLabel}: ${
						error instanceof Error ? error.message : String(error)
					}`,
					{ model, requestLabel },
				),
			);
		}
	};
}
