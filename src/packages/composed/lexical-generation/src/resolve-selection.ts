import { SelectionSchema } from "@textfresser/linguistics";
import type { z } from "zod/v3";
import { err, ok } from "neverthrow";
import {
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "./errors";
import { executePrompt } from "./internal/prompt-executor";
import {
	operationRegistry,
	type ResolveSelectionPromptOutput,
} from "./internal/prompt-registry";
import type {
	CreateLexicalGenerationClientParams,
	ResolvedSelection,
	SelectionResolver,
} from "./public-types";

type EvaluatedSelectionOutput = {
	issueCount: number;
	output: ResolveSelectionPromptOutput;
};

type KnownOrthographicStatus = Exclude<
	keyof typeof SelectionSchema.German,
	"Unknown"
>;

function getLexemeSelectionSchema(
	orthographicStatus: KnownOrthographicStatus,
	surfaceKind: "Lemma" | "Inflection" | "Variant" | "Partial",
	discriminator: ResolveSelectionPromptOutput["discriminator"],
): z.ZodTypeAny | null {
	if (typeof discriminator !== "string") {
		return null;
	}

	const surfaceBranch = SelectionSchema.German[orthographicStatus][surfaceKind];
	if (!surfaceBranch || !("Lexeme" in surfaceBranch)) {
		return null;
	}

	const schema = (surfaceBranch.Lexeme as Record<string, z.ZodTypeAny | undefined>)[
		discriminator
	];
	return schema ?? null;
}

function getPhrasemeSelectionSchema(
	orthographicStatus: KnownOrthographicStatus,
	discriminator: ResolveSelectionPromptOutput["discriminator"],
): z.ZodTypeAny | null {
	if (typeof discriminator !== "string") {
		return null;
	}

	const lemmaBranch = SelectionSchema.German[orthographicStatus].Lemma;
	if (!lemmaBranch || !("Phraseme" in lemmaBranch)) {
		return null;
	}

	const schema = (lemmaBranch.Phraseme as Record<string, z.ZodTypeAny | undefined>)[
		discriminator
	];
	return schema ?? null;
}

function evaluateSelectionOutput(
	selection: string,
	output: ResolveSelectionPromptOutput,
): EvaluatedSelectionOutput {
	let issueCount = 0;

	if (output.orthographicStatus !== "Unknown") {
		if (!output.lemmaKind || !output.spelledLemma || !output.surfaceKind) {
			issueCount += 10;
		}
		if (output.lemmaKind === "Lexeme" && !output.discriminator) {
			issueCount += 10;
		}
		if (output.surfaceKind !== "Lemma" && output.spelledLemma === selection) {
			issueCount += 1;
		}
	}

	return { issueCount, output };
}

function pickBestSelectionOutput(params: {
	first: EvaluatedSelectionOutput;
	second: EvaluatedSelectionOutput;
}) {
	if (params.second.issueCount < params.first.issueCount) {
		return params.second.output;
	}
	return params.first.output;
}

function toResolvedSelection(
	selection: string,
	attestation: string,
	output: ResolveSelectionPromptOutput,
): ResolvedSelection | null {
	if (output.orthographicStatus === "Unknown") {
		return {
			contextWithLinkedParts: output.contextWithLinkedParts ?? attestation,
			orthographicStatus: "Unknown",
		};
	}

	if (!output.lemmaKind || !output.spelledLemma || !output.surfaceKind) {
		return null;
	}

	const orthographicStatus = (output.orthographicStatus ?? "Standard") as KnownOrthographicStatus;
	const base = {
		contextWithLinkedParts: output.contextWithLinkedParts ?? attestation,
		orthographicStatus,
		surface: {
			spelledSurface: selection,
			surfaceKind: output.surfaceKind,
		},
	};

	if (output.lemmaKind === "Lexeme") {
		if (!output.discriminator) {
			return null;
		}

		const rawSelection = {
			...base,
			surface: {
				...base.surface,
				...(output.surfaceKind === "Inflection"
					? { inflectionalFeatures: {} }
					: {}),
				lemma: {
					lemmaKind: "Lexeme" as const,
					pos: output.discriminator,
					spelledLemma: output.spelledLemma,
				},
			},
		};

		const schema = getLexemeSelectionSchema(
			orthographicStatus,
			output.surfaceKind,
			output.discriminator,
		);
		if (!schema) {
			return null;
		}

		const parsed = schema.safeParse(rawSelection);
		return parsed.success ? (parsed.data as ResolvedSelection) : null;
	}

	if (output.lemmaKind === "Phraseme") {
		if (!output.discriminator || output.surfaceKind !== "Lemma") {
			return null;
		}

		const rawSelection = {
			...base,
			surface: {
				...base.surface,
				lemma: {
					lemmaKind: "Phraseme" as const,
					phrasemeKind: output.discriminator,
					spelledLemma: output.spelledLemma,
				},
			},
		};

		const schema = getPhrasemeSelectionSchema(
			orthographicStatus,
			output.discriminator,
		);
		if (!schema) {
			return null;
		}

		const parsed = schema.safeParse(rawSelection);
		return parsed.success ? (parsed.data as ResolvedSelection) : null;
	}

	return null;
}

export function buildSelectionResolver(
	deps: Pick<
		CreateLexicalGenerationClientParams,
		"fetchStructured" | "knownLanguage" | "targetLanguage"
	>,
): SelectionResolver {
	return async (selection, attestation) => {
		const firstAttempt = await executePrompt(
			deps,
			operationRegistry.resolveSelection,
			{
				attestation,
				selection,
			},
		);
		if (firstAttempt.isErr()) {
			return err(firstAttempt.error);
		}

		const firstEvaluation = evaluateSelectionOutput(
			selection,
			firstAttempt.value,
		);
		if (firstEvaluation.issueCount === 0) {
			const parsed = toResolvedSelection(
				selection,
				attestation,
				firstEvaluation.output,
			);
			if (parsed) {
				return ok(parsed);
			}
		}

		const secondAttempt = await executePrompt(
			deps,
			operationRegistry.resolveSelection,
			{
				attestation,
				selection,
			},
		);
		if (secondAttempt.isErr()) {
			const parsed = toResolvedSelection(
				selection,
				attestation,
				firstEvaluation.output,
			);
			if (parsed) {
				return ok(parsed);
			}
			return err(secondAttempt.error);
		}

		const chosen = pickBestSelectionOutput({
			first: firstEvaluation,
			second: evaluateSelectionOutput(selection, secondAttempt.value),
		});
		const parsed = toResolvedSelection(selection, attestation, chosen);
		if (!parsed) {
			return err(
				lexicalGenerationError(
					LexicalGenerationFailureKind.InvalidModelOutput,
					"ResolveSelection returned an invalid native selection payload",
					{ selection },
				),
			);
		}

		return ok(parsed);
	};
}
