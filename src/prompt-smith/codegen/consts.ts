import { z } from "zod";

const supportedPromptKinds = ["Translate"] as const;

export const PromptKindSchema = z.enum(supportedPromptKinds);

export type PromptKind = z.infer<typeof PromptKindSchema>;
export const PromptKind = PromptKindSchema.enum;
export const ALL_PROMPT_KINDS = PromptKindSchema.options;

// Take supported languages from types.ts

export const PromptPartKind = z.enum([
	"AgentRole",
	"TaskDescription",
	"Example",
]);
