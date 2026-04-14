import {
	createLexicalMeta,
	type LexicalInfo,
	type LexicalMeta,
} from "@textfresser/lexical-generation";
import type { LemmaResult } from "../../lemma/types";

function resolveSenseEmojis(lexicalInfo: LexicalInfo): string[] {
	if (lexicalInfo.core.status === "ready") {
		return lexicalInfo.core.value.senseEmojis;
	}

	return ["❓"];
}

export function buildLexicalMeta(
	lemmaResult: LemmaResult,
	lexicalInfo: LexicalInfo,
): LexicalMeta {
	return createLexicalMeta({
		senseEmojis: resolveSenseEmojis(lexicalInfo),
		selection: lemmaResult,
	});
}
