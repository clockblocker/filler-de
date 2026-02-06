import type { z } from "zod/v3";
import type { Prettify } from "../../types/helpers";
import {
	type PromptKind,
	PromptKind as PromptKindEnum,
} from "../codegen/consts";
import { morphemSchemas } from "./morphem";
import { translateSchemas } from "./translate";

export const SchemasFor = {
	[PromptKindEnum.Translate]: translateSchemas,
	[PromptKindEnum.Morphem]: morphemSchemas,
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
