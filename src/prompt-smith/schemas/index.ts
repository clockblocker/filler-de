import type { z } from "zod/v3";
import type { Prettify } from "../../types/helpers";
import {
	type PromptKind,
	PromptKind as PromptKindEnum,
} from "../codegen/consts";
import { disambiguateSchemas } from "./disambiguate";
import { featuresAdjectiveSchemas } from "./features-adjective";
import { featuresAdverbSchemas } from "./features-adverb";
import { featuresArticleSchemas } from "./features-article";
import { featuresConjunctionSchemas } from "./features-conjunction";
import { featuresInteractionalUnitSchemas } from "./features-interactional-unit";
import { featuresNounSchemas } from "./features-noun";
import { featuresParticleSchemas } from "./features-particle";
import { featuresPrepositionSchemas } from "./features-preposition";
import { featuresPronounSchemas } from "./features-pronoun";
import { featuresVerbSchemas } from "./features-verb";
import { inflectionSchemas } from "./inflection";
import { lemmaSchemas } from "./lemma";
import { lexemEnrichmentSchemas } from "./lexem-enrichment";
import { morphemSchemas } from "./morphem";
import { nounInflectionSchemas } from "./noun-inflection";
import { phrasemEnrichmentSchemas } from "./phrasem-enrichment";
import { relationSchemas } from "./relation";
import { translateSchemas } from "./translate";
import { wordTranslationSchemas } from "./word-translation";

export const SchemasFor = {
	[PromptKindEnum.Translate]: translateSchemas,
	[PromptKindEnum.Morphem]: morphemSchemas,
	[PromptKindEnum.Lemma]: lemmaSchemas,
	[PromptKindEnum.LexemEnrichment]: lexemEnrichmentSchemas,
	[PromptKindEnum.PhrasemEnrichment]: phrasemEnrichmentSchemas,
	[PromptKindEnum.Relation]: relationSchemas,
	[PromptKindEnum.Inflection]: inflectionSchemas,
	[PromptKindEnum.NounInflection]: nounInflectionSchemas,
	[PromptKindEnum.Disambiguate]: disambiguateSchemas,
	[PromptKindEnum.WordTranslation]: wordTranslationSchemas,
	[PromptKindEnum.FeaturesNoun]: featuresNounSchemas,
	[PromptKindEnum.FeaturesPronoun]: featuresPronounSchemas,
	[PromptKindEnum.FeaturesArticle]: featuresArticleSchemas,
	[PromptKindEnum.FeaturesAdjective]: featuresAdjectiveSchemas,
	[PromptKindEnum.FeaturesVerb]: featuresVerbSchemas,
	[PromptKindEnum.FeaturesPreposition]: featuresPrepositionSchemas,
	[PromptKindEnum.FeaturesAdverb]: featuresAdverbSchemas,
	[PromptKindEnum.FeaturesParticle]: featuresParticleSchemas,
	[PromptKindEnum.FeaturesConjunction]: featuresConjunctionSchemas,
	[PromptKindEnum.FeaturesInteractionalUnit]:
		featuresInteractionalUnitSchemas,
} satisfies Record<
	PromptKind,
	{ userInputSchema: z.ZodTypeAny; agentOutputSchema: z.ZodTypeAny }
>;

export type UserInput<K extends PromptKind = PromptKind> = Prettify<
	z.infer<(typeof SchemasFor)[K]["userInputSchema"]>
>;
export type AgentOutput<K extends PromptKind = PromptKind> = Prettify<
	z.infer<(typeof SchemasFor)[K]["agentOutputSchema"]>
>;
