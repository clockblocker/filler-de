import type { z } from "zod/v3";
import type { Prettify } from "../../types/helpers";
import {
	type PromptKind,
	PromptKind as PromptKindEnum,
} from "../codegen/consts";
import { headerSchemas } from "./header";
import { inflectionSchemas } from "./inflection";
import { lemmaSchemas } from "./lemma";
import { morphemSchemas } from "./morphem";
import { relationSchemas } from "./relation";
import { translateSchemas } from "./translate";

export const SchemasFor = {
	[PromptKindEnum.Translate]: translateSchemas,
	[PromptKindEnum.Morphem]: morphemSchemas,
	[PromptKindEnum.Lemma]: lemmaSchemas,
	[PromptKindEnum.Header]: headerSchemas,
	[PromptKindEnum.Relation]: relationSchemas,
	[PromptKindEnum.Inflection]: inflectionSchemas,
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
