import type { z } from "zod";
import type { Prettify } from "../../types/helpers";
import {
	type PromptKind,
	PromptKind as PromptKindEnum,
} from "../codegen/consts";
import { translateSchemas } from "./translate";

export const SchemasFor = {
	[PromptKindEnum.Translate]: translateSchemas,
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
