import { err, type Result } from "neverthrow";
import type { z } from "zod/v3";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "../errors";
import type { CreateLexicalGenerationClientParams } from "../public-types";
import { getRequiredPromptSpecs, type PromptSpec } from "./prompt-registry";

type PromptExecutorDeps = Pick<
	CreateLexicalGenerationClientParams,
	"fetchStructured" | "knownLanguage" | "targetLanguage"
>;

export function validatePromptAvailability(
	params: Pick<
		CreateLexicalGenerationClientParams,
		"knownLanguage" | "targetLanguage"
	>,
) {
	if (
		params.targetLanguage !== "German" ||
		params.knownLanguage !== "English"
	) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.UnsupportedLanguagePair,
				`Unsupported language pair: ${params.targetLanguage} -> ${params.knownLanguage}`,
				{
					knownLanguage: params.knownLanguage,
					targetLanguage: params.targetLanguage,
				},
			),
		);
	}

	for (const prompt of getRequiredPromptSpecs()) {
		if (!prompt.requestLabel || !prompt.systemPrompt || !prompt.outputSchema) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.PromptNotAvailable,
					"Prompt registry is incomplete",
					{ requestLabel: prompt.requestLabel },
				),
			);
		}
	}

	return null;
}

export async function executePrompt<TInput, TOutput>(
	deps: PromptExecutorDeps,
	prompt: PromptSpec<TInput, TOutput>,
	input: TInput,
): Promise<Result<TOutput, import("../errors").LexicalGenerationError>> {
	try {
		return await deps.fetchStructured<TOutput>({
			requestLabel: prompt.requestLabel,
			schema: prompt.outputSchema as z.ZodType<TOutput>,
			systemPrompt: prompt.systemPrompt,
			userInput: JSON.stringify(input),
			withCache: true,
		});
	} catch (error) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.InternalContractViolation,
				`fetchStructured threw while executing ${prompt.requestLabel}`,
				{
					error:
						error instanceof Error ? error.message : String(error),
					requestLabel: prompt.requestLabel,
				},
			),
		);
	}
}
