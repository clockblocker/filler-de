import { GermanNounIdentityFeatureKeys } from "./german/lu/lexeme/noun/german-noun-bundle";
import { GermanVerbIdentityFeatureKeys } from "./german/lu/lexeme/verb/german-verb-bundle";
import { GermanMorphemeIdentityFeatureKeysByKind } from "./german/lu/morpheme/german-morphemes";
import type { AbstractFeatures } from "./universal/enums/feature/feature";

type IdentityFeatureKey = keyof AbstractFeatures;

export const identityFeatureRegistry = {
	English: {
		Lexeme: {},
		Morpheme: {},
		Phraseme: {},
	},
	German: {
		Lexeme: {
			NOUN: GermanNounIdentityFeatureKeys,
			VERB: GermanVerbIdentityFeatureKeys,
		},
		Morpheme: GermanMorphemeIdentityFeatureKeysByKind,
		Phraseme: {},
	},
} satisfies Record<
	string,
	Record<string, Record<string, readonly IdentityFeatureKey[]>>
>;
