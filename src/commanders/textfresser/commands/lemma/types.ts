import type {
	LinguisticUnitKind,
	SurfaceKind,
} from "../../../../linguistics/common/enums/core";
import type { POS } from "../../../../linguistics/common/enums/linguistic-units/lexem/pos";
import type { CollocationStrength } from "../../../../linguistics/common/enums/linguistic-units/phrasem/collocation-strength";
import type { CollocationType } from "../../../../linguistics/common/enums/linguistic-units/phrasem/collocation-type";
import type { DiscourseFormulaRole } from "../../../../linguistics/common/enums/linguistic-units/phrasem/discourse-formula-role";
import type { PhrasemeKind } from "../../../../linguistics/common/enums/linguistic-units/phrasem/phrasem-kind";
import type { GermanGenus } from "../../../../linguistics/de/lexem/noun/features";
import type { Attestation } from "../../common/attestation/types";

export type NounClass = "Common" | "Proper";

type PhrasemeFeaturesByKind = {
	Collocation: {
		collocationType?: CollocationType;
		phrasemeKind: "Collocation";
		strength?: CollocationStrength;
	};
	CulturalQuotation: {
		phrasemeKind: "CulturalQuotation";
	};
	DiscourseFormula: {
		phrasemeKind: "DiscourseFormula";
		role?: DiscourseFormulaRole;
	};
	Idiom: {
		phrasemeKind: "Idiom";
	};
	Proverb: {
		phrasemeKind: "Proverb";
	};
};

export type PhrasemeFeatures<K extends PhrasemeKind = PhrasemeKind> =
	PhrasemeFeaturesByKind[K];

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
	/** Grammatical gender. Only meaningful for Nouns. */
	genus?: GermanGenus;
	/** Phraseme kind and optional kind-specific features. */
	phrasemeFeatures?: PhrasemeFeatures;
};
