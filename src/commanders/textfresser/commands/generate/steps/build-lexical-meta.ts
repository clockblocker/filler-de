import {
	createLexicalMeta,
	type LexicalInfo,
	type LexicalMeta,
} from "@textfresser/lexical-generation";
import type { LemmaResult } from "../../lemma/types";

function resolveEmojiDescription(lexicalInfo: LexicalInfo): string[] {
	if (lexicalInfo.core.status === "ready") {
		return lexicalInfo.core.value.emojiDescription;
	}

	return ["❓"];
}

export function buildLexicalMeta(
	lemmaResult: LemmaResult,
	lexicalInfo: LexicalInfo,
): LexicalMeta {
	return createLexicalMeta({
		emojiDescription: resolveEmojiDescription(lexicalInfo),
		selection: lemmaResult,
	});
}
