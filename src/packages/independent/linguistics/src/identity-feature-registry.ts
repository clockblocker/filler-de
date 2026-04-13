import type { AbstractFeatures } from "./universal/enums/feature/feature";
import { GermanMorphemeIdentityFeatureKeysByKind } from "./german/lu/morpheme/german-morphemes";
import { GermanNounIdentityFeatureKeys } from "./german/lu/lexeme/noun/german-noun-bundle";
import { GermanVerbIdentityFeatureKeys } from "./german/lu/lexeme/verb/german-verb-bundle";

type IdentityFeatureKey = keyof AbstractFeatures;

export const identityFeatureRegistry = {
	German: {
		Lexeme: {
			NOUN: GermanNounIdentityFeatureKeys,
			VERB: GermanVerbIdentityFeatureKeys,
		},
		Morpheme: GermanMorphemeIdentityFeatureKeysByKind,
		Phraseme: {},
	},
	English: {
		Lexeme: {},
		Morpheme: {},
		Phraseme: {},
	},
} satisfies Record<
	string,
	Record<string, Record<string, readonly IdentityFeatureKey[]>>
>;
