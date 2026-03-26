import type {
	KnownLanguage,
	TargetLanguage,
} from "./internal/shared/languages";
import {
	type AgentOutput,
	PROMPT_FOR,
	SchemasFor,
	type UserInput,
} from "./internal/prompt-smith";
import {
	PromptKind as PromptKindEnum,
	type PromptKind as InternalPromptKind,
} from "./internal/prompt-smith/codegen/consts";

export const PromptKind = PromptKindEnum;
export type PromptKind = InternalPromptKind;

export type PromptInput<K extends PromptKind> = UserInput<K>;
export type PromptOutput<K extends PromptKind> = AgentOutput<K>;

export function getLexicalPromptSystemPrompt(params: {
	kind: PromptKind;
	known: KnownLanguage;
	target: TargetLanguage;
}): string {
	return PROMPT_FOR[params.target][params.known][params.kind].systemPrompt;
}

export function getLexicalPromptOutputSchema(kind: PromptKind) {
	return SchemasFor[kind].agentOutputSchema;
}
