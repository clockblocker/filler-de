import { lingSchemaFor } from "@textfresser/linguistics";
import { err, ok } from "neverthrow";
import { executePrompt } from "../internal/prompt-executor";
import type {
	CreateLexicalGenerationModuleParams,
	ResolvedSelection,
	SelectionResolver,
} from "../public-types";
import {
	chooseBestEffortLemmaOutput,
	evaluateLemmaOutputGuardrails,
} from "./guardrails";

const SelectionSchema = lingSchemaFor.Selection;

const POS_FROM_LEGACY = {
	Adjective: "ADJ",
	Adverb: "ADV",
	Article: "DET",
	Conjunction: "CCONJ",
	InteractionalUnit: "INTJ",
	Noun: "NOUN",
	Particle: "PART",
	Preposition: "ADP",
	Pronoun: "PRON",
	Verb: "VERB",
} as const;

const PHRASEME_KIND_FROM_LEGACY = {
	Collocation: "Idiom",
	CulturalQuotation: "Aphorism",
	DiscourseFormula: "DiscourseFormula",
	Idiom: "Idiom",
	Proverb: "Proverb",
} as const;

const SURFACE_KIND_FROM_LEGACY = {
	Inflected: "Inflection",
	Lemma: "Lemma",
	Variant: "Lemma",
} as const;

function toResolvedSelection(output: {
	contextWithLinkedParts: string;
	lemma: string;
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
	surfaceKind: "Lemma" | "Inflected" | "Variant" | "Partial";
	spelledSurface: string;
}): ResolvedSelection {
	const surfaceKind =
		output.surfaceKind === "Partial"
			? "Lemma"
			: SURFACE_KIND_FROM_LEGACY[output.surfaceKind];
	const normalizedFullSurface =
		output.surfaceKind === "Partial" ? output.lemma : output.spelledSurface;
	const base = {
		language: "German" as const,
		orthographicStatus: "Standard" as const,
		selectionCoverage:
			output.surfaceKind === "Partial" ? ("Partial" as const) : ("Full" as const),
		spelledSelection: output.spelledSurface,
		surface: {
			language: "German" as const,
			normalizedFullSurface,
			surfaceKind,
		},
	};

	if (output.linguisticUnit === "Lexem") {
		const pos =
			POS_FROM_LEGACY[output.posLikeKind as keyof typeof POS_FROM_LEGACY];

		const rawSelection = {
			...base,
			surface: {
				...base.surface,
				...(surfaceKind === "Inflection"
					? { inflectionalFeatures: {} }
					: {}),
				discriminators: {
					lemmaKind: "Lexeme" as const,
					lemmaSubKind: pos,
				},
				target: {
					canonicalLemma: output.lemma,
				},
			},
		};
		const parsed =
			SelectionSchema.German.Standard[surfaceKind].Lexeme[pos].parse(
				rawSelection,
			);
		return {
			...parsed,
			contextWithLinkedParts: output.contextWithLinkedParts,
		};
	}

	const phrasemeKind =
		PHRASEME_KIND_FROM_LEGACY[
			output.posLikeKind as keyof typeof PHRASEME_KIND_FROM_LEGACY
		];

	const rawSelection = {
		...base,
		surface: {
			...base.surface,
			discriminators: {
				lemmaKind: "Phraseme" as const,
				lemmaSubKind: phrasemeKind,
			},
			target: {
				canonicalLemma: output.lemma,
			},
		},
	};
	const parsed =
		SelectionSchema.German.Standard.Lemma.Phraseme[phrasemeKind].parse(
			rawSelection,
		);
	return {
		...parsed,
		contextWithLinkedParts: output.contextWithLinkedParts,
	};
}

export function buildSelectionResolver(
	deps: Pick<
		CreateLexicalGenerationModuleParams,
		"fetchStructured" | "knownLang" | "targetLang"
	>,
): SelectionResolver {
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
			return ok(
				toResolvedSelection({
					...firstEvaluation.output,
					spelledSurface: selection,
				}),
			);
		}

		const secondAttempt = await executePrompt(deps, "Lemma", {
			context: attestation,
			surface: selection,
		});
		if (secondAttempt.isErr()) {
			return ok(
				toResolvedSelection({
					...firstEvaluation.output,
					spelledSurface: selection,
				}),
			);
		}

		const secondEvaluation = evaluateLemmaOutputGuardrails({
			context: attestation,
			output: secondAttempt.value,
			surface: selection,
		});

		return ok(
			toResolvedSelection({
				...chooseBestEffortLemmaOutput({
					first: firstEvaluation,
					second: secondEvaluation,
				}).output,
				spelledSurface: selection,
			}),
		);
	};
}
