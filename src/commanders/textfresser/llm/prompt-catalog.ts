import {
	getLexicalPromptOutputSchema,
	getLexicalPromptSystemPrompt,
	type PromptInput,
	type PromptKind,
	type PromptOutput,
} from "../../../lexical-generation";
import type { KnownLanguage, TargetLanguage } from "../../../types";

export type { PromptKind } from "../../../lexical-generation";

export function getPromptSystemPrompt(params: {
	target: TargetLanguage;
	known: KnownLanguage;
	kind: PromptKind;
}): string {
	return getLexicalPromptSystemPrompt(params);
}

export function getPromptOutputSchema(kind: PromptKind) {
	return getLexicalPromptOutputSchema(kind);
}

export type { PromptInput, PromptOutput };
