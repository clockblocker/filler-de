import type { z } from "zod/v3";
import type { Prettify } from "../../types/helpers";
import {
	type PromptKind,
	PromptKind as PromptKindEnum,
} from "../codegen/consts";
import { disambiguateSchemas } from "./disambiguate";
import { featuresSchemas } from "./features";
import { inflectionSchemas } from "./inflection";
import { lemmaSchemas } from "./lemma";
import { morphemSchemas } from "./morphem";
import { nounInflectionSchemas } from "./noun-inflection";
import { relationSchemas } from "./relation";
import { translateSchemas } from "./translate";
import { wordTranslationSchemas } from "./word-translation";

export const SchemasFor = {
	[PromptKindEnum.Translate]: translateSchemas,
	[PromptKindEnum.Morphem]: morphemSchemas,
	[PromptKindEnum.Lemma]: lemmaSchemas,
	[PromptKindEnum.Relation]: relationSchemas,
	[PromptKindEnum.Inflection]: inflectionSchemas,
	[PromptKindEnum.NounInflection]: nounInflectionSchemas,
	[PromptKindEnum.Disambiguate]: disambiguateSchemas,
	[PromptKindEnum.WordTranslation]: wordTranslationSchemas,
	[PromptKindEnum.Features]: featuresSchemas,
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
