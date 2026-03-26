import type { ResolvedLemma } from "@textfresser/lexical-generation";
import type { Attestation } from "../../common/attestation/types";

type LemmaLocalState = {
	attestation: Attestation;
	/** null = new sense or first encounter */
	disambiguationResult: { matchedIndex: number } | null;
	/** Emoji description precomputed by Disambiguate prompt when it detects a new sense. */
	precomputedEmojiDescription?: string[];
};

export type LemmaResult = ResolvedLemma & LemmaLocalState;

export function getLexemPos(
	result: LemmaResult,
):
	| Extract<ResolvedLemma, { linguisticUnit: "Lexem" }>["posLikeKind"]
	| undefined {
	return result.linguisticUnit === "Lexem" ? result.posLikeKind : undefined;
}
