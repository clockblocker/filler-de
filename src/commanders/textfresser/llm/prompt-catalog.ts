import {
	type AgentOutput,
	PROMPT_FOR,
	SchemasFor,
	type UserInput,
} from "../../../prompt-smith";
import type { PromptKind } from "../../../prompt-smith/codegen/consts";
import type { KnownLanguage, TargetLanguage } from "../../../types";

export type { PromptKind } from "../../../prompt-smith/codegen/consts";

export function getPromptSystemPrompt(params: {
	target: TargetLanguage;
	known: KnownLanguage;
	kind: PromptKind;
}): string {
	return PROMPT_FOR[params.target][params.known][params.kind].systemPrompt;
}

export function getPromptOutputSchema(kind: PromptKind) {
	return SchemasFor[kind].agentOutputSchema;
}

export type PromptInput<K extends PromptKind> = UserInput<K>;
export type PromptOutput<K extends PromptKind> = AgentOutput<K>;
