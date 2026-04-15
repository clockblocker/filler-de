import type { TargetLanguage } from "./enums/core/language";
import type { AbstractFeatures } from "./enums/feature";
import type { Pos } from "./enums/kind/pos";

export const canonicalLemmaFormMetadata: Partial<
	Record<TargetLanguage, Partial<Record<Pos, CanonicalLemmaForm>>>
> = {
	English: {
		NOUN: {
			number: "Sing",
		},
		PROPN: {
			number: "Sing",
		},
		VERB: {
			verbForm: "Inf",
		},
	},
	German: {
		NOUN: {
			case: "Nom",
			number: "Sing",
		},
		PROPN: {
			case: "Nom",
			number: "Sing",
		},
		VERB: {
			verbForm: "Inf",
		},
	},
};

type CanonicalLemmaForm = Partial<
	Pick<AbstractFeatures, "case" | "number" | "tense" | "verbForm">
>;
