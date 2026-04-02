import type {
	LexicalRelationKind,
} from "@textfresser/lexical-generation";
import type { LexicalGenus } from "@textfresser/linguistics";
import type { TargetLanguage } from "../../../../../types";
import type { TextfresserNounInflectionCell } from "../../../domain/lexical-types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";

export type ParsedRelation = {
	kind: LexicalRelationKind;
	words: string[];
};

export type PrefixEquationPayload = {
	baseLemma: string;
	prefixDisplay: string;
	prefixTarget: string;
	sourceLemma: string;
};

export type MorphologyPayload = {
	compoundedFromLemmas: string[];
	derivedFromLemma?: string;
	prefixEquation?: PrefixEquationPayload;
};

export type GeneratedPropagationArtifacts = {
	/** Structured propagation inputs derived from LexicalInfo render helpers. */
	inflectionCells: TextfresserNounInflectionCell[];
	morphology?: MorphologyPayload;
	morphemes: MorphemeItem[];
	nounInflectionGenus?: LexicalGenus;
	relations: ParsedRelation[];
	sourceTranslation?: string;
};

export type GenerationTargetLanguage = TargetLanguage;
