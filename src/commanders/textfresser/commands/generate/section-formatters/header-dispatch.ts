import type { LexicalInfo } from "@textfresser/lexical-generation";
import type { LexicalGenus } from "../../../domain/lexical-types";
import {
	getLexicalInfoGender,
	getLexicalInfoLemma,
	getLexicalInfoPos,
	isLexicalInfoLexeme,
} from "../../../domain/lexical-info-view";
import { formatHeaderLine as formatCommonHeader } from "./common/header-formatter";
import { formatHeaderLine as formatNounHeader } from "./de/lexem/noun/header-formatter";

function resolveHeaderCore(lexicalInfo: LexicalInfo): {
	emojiDescription: string[];
	ipa: string;
} {
	if (lexicalInfo.core.status === "ready") {
		return {
			emojiDescription: lexicalInfo.core.value.emojiDescription,
			ipa: lexicalInfo.core.value.ipa,
		};
	}

	return {
		emojiDescription: ["❓"],
		ipa: "unknown",
	};
}

function resolveNounGender(lexicalInfo: LexicalInfo): LexicalGenus | undefined {
	if (!isLexicalInfoLexeme(lexicalInfo) || getLexicalInfoPos(lexicalInfo) !== "NOUN") {
		return undefined;
	}

	return getLexicalInfoGender(lexicalInfo);
}

export function dispatchHeaderFormatter(
	lexicalInfo: LexicalInfo,
	targetLanguage: string,
): string {
	const output = resolveHeaderCore(lexicalInfo);
	const lemma = getLexicalInfoLemma(lexicalInfo) ?? "unknown";

	if (isLexicalInfoLexeme(lexicalInfo) && getLexicalInfoPos(lexicalInfo) === "NOUN") {
		const nounGender = resolveNounGender(lexicalInfo);
		if (nounGender) {
			return formatNounHeader(output, lemma, targetLanguage, nounGender);
		}
	}

	return formatCommonHeader(output, lemma, targetLanguage);
}
