import type {
	GermanGenus,
	NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import type { RelationSubKind } from "../../../../../lexical-generation/internal/prompt-smith/schemas/relation";
import type { TargetLanguage } from "../../../../../types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";

export type ParsedRelation = {
	kind: RelationSubKind;
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
	inflectionCells: NounInflectionCell[];
	morphology?: MorphologyPayload;
	morphemes: MorphemeItem[];
	nounInflectionGenus?: GermanGenus;
	relations: ParsedRelation[];
	sourceTranslation?: string;
};

export type GenerationTargetLanguage = TargetLanguage;
