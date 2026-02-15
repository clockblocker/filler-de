import type { SurfaceKind } from "../../../../linguistics/common/enums/core";
import type { PhrasemeKind } from "../../../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import type { DeLexemPos } from "../../../../linguistics/de/lemma";
import type { Attestation } from "../../common/attestation/types";

type LemmaResultBase = {
	surfaceKind: SurfaceKind;
	lemma: string;
	attestation: Attestation;
	/** null = new sense or first encounter */
	disambiguationResult: { matchedIndex: number } | null;
	/** Emoji description precomputed by Disambiguate prompt when it detects a new sense. */
	precomputedEmojiDescription?: string[];
};

type LexemLemmaResult = LemmaResultBase & {
	linguisticUnit: "Lexem";
	posLikeKind: DeLexemPos;
};

type PhrasemLemmaResult = LemmaResultBase & {
	linguisticUnit: "Phrasem";
	posLikeKind: PhrasemeKind;
};

export type LemmaResult = LexemLemmaResult | PhrasemLemmaResult;

export function getLexemPos(result: LemmaResult): DeLexemPos | undefined {
	return result.linguisticUnit === "Lexem" ? result.posLikeKind : undefined;
}
