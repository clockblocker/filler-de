import { err, ok } from "neverthrow";
import { executePrompt } from "../internal/prompt-executor";
import type {
	CreateLexicalGenerationModuleParams,
	LemmaGenerator,
	ResolvedLemma,
} from "../public-types";
import {
	chooseBestEffortLemmaOutput,
	evaluateLemmaOutputGuardrails,
} from "./guardrails";

function toResolvedLemma(output: {
	contextWithLinkedParts?: string | null;
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
	surfaceKind: "Lemma" | "Inflected" | "Variant";
}): ResolvedLemma {
	if (output.linguisticUnit === "Lexem") {
		return {
			contextWithLinkedParts: output.contextWithLinkedParts ?? undefined,
			lemma: output.lemma,
			linguisticUnit: "Lexem",
			posLikeKind: output.posLikeKind as Extract<
				ResolvedLemma,
				{ linguisticUnit: "Lexem" }
			>["posLikeKind"],
			surfaceKind: output.surfaceKind,
		};
	}

	return {
		contextWithLinkedParts: output.contextWithLinkedParts ?? undefined,
		lemma: output.lemma,
		linguisticUnit: "Phrasem",
		posLikeKind: output.posLikeKind as Extract<
			ResolvedLemma,
			{ linguisticUnit: "Phrasem" }
		>["posLikeKind"],
		surfaceKind: output.surfaceKind,
	};
}

export function buildLemmaGenerator(
	deps: Pick<
		CreateLexicalGenerationModuleParams,
		"fetchStructured" | "knownLang" | "targetLang"
	>,
): LemmaGenerator {
	return async (selection: string, attestation: string) => {
		const firstAttempt = await executePrompt(deps, "Lemma", {
			context: attestation,
			surface: selection,
		});
		if (firstAttempt.isErr()) {
			return err(firstAttempt.error);
		}

		const firstEvaluation = evaluateLemmaOutputGuardrails({
			context: attestation,
			output: firstAttempt.value,
			surface: selection,
		});

		if (firstEvaluation.coreIssues.length === 0) {
			return ok(toResolvedLemma(firstEvaluation.output));
		}

		const secondAttempt = await executePrompt(deps, "Lemma", {
			context: attestation,
			surface: selection,
		});
		if (secondAttempt.isErr()) {
			return ok(toResolvedLemma(firstEvaluation.output));
		}

		const secondEvaluation = evaluateLemmaOutputGuardrails({
			context: attestation,
			output: secondAttempt.value,
			surface: selection,
		});

		return ok(
			toResolvedLemma(
				chooseBestEffortLemmaOutput({
					first: firstEvaluation,
					second: secondEvaluation,
				}).output,
			),
		);
	};
}
