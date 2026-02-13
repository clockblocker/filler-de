import type {
	LinguisticUnitKind,
	SurfaceKind,
} from "../../../../linguistics/common/enums/core";
import type { POS } from "../../../../linguistics/common/enums/linguistic-units/lexem/pos";
import type { Attestation } from "../../common/attestation/types";

export type NounClass = "Common" | "Proper";

export type LemmaResult = {
	linguisticUnit: LinguisticUnitKind;
	pos?: POS;
	surfaceKind: SurfaceKind;
	lemma: string;
	attestation: Attestation;
	/** 1-3 emojis capturing the core semantic concept, from Lemma LLM output. */
	emojiDescription: string[];
	/** IPA pronunciation from Lemma LLM output. */
	ipa: string;
	/** null = new sense or first encounter */
	disambiguationResult: { matchedIndex: number } | null;
	/** Emoji description precomputed by Disambiguate prompt when it detects a new sense. */
	precomputedEmojiDescription?: string[];
	/** "Common" (default) or "Proper" (named entity). Only meaningful for Nouns. */
	nounClass?: NounClass;
};
