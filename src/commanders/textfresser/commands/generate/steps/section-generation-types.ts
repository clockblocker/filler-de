import type {
	GermanGenus,
	NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import type { AgentOutput } from "../../../../../prompt-smith";
import type { RelationSubKind } from "../../../../../prompt-smith/schemas/relation";
import type { MorphemeItem } from "../../../../../stateless-helpers/morpheme-formatter";
import type { TargetLanguage } from "../../../../../types";

export type ParsedRelation = {
	kind: RelationSubKind;
	words: string[];
};

export type LexemEnrichmentOutput = AgentOutput<"LexemEnrichment">;
export type PhrasemEnrichmentOutput = AgentOutput<"PhrasemEnrichment">;
export type EnrichmentOutput = LexemEnrichmentOutput | PhrasemEnrichmentOutput;

export type MorphemOutput = AgentOutput<"Morphem">;
export type RelationOutput = AgentOutput<"Relation">;
export type NounInflectionOutput = AgentOutput<"NounInflection">;
export type InflectionOutput = AgentOutput<"Inflection">;
export type WordTranslationOutput = AgentOutput<"WordTranslation">;
export type TagFeaturesOutput = AgentOutput<"FeaturesNoun">;
export type AdjectiveFeaturesOutput = AgentOutput<"FeaturesAdjective">;
export type VerbFeaturesOutput = AgentOutput<"FeaturesVerb">;
export type FeaturesOutput =
	| TagFeaturesOutput
	| AdjectiveFeaturesOutput
	| VerbFeaturesOutput;

export type GeneratedSectionArtifacts = {
	inflectionCells: NounInflectionCell[];
	morphemes: MorphemeItem[];
	nounInflectionGenus?: GermanGenus;
	relations: ParsedRelation[];
};

export type GenerationTargetLanguage = TargetLanguage;
