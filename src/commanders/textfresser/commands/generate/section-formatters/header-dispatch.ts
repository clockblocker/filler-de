import type {
	LexicalGenus,
	LexicalInfo,
} from "../../../../../lexical-generation";
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

function resolveNounGenus(lexicalInfo: LexicalInfo): LexicalGenus | undefined {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.lemma.posLikeKind !== "Noun"
	) {
		return undefined;
	}

	if (
		lexicalInfo.features.status === "ready" &&
		lexicalInfo.features.value.kind === "noun" &&
		lexicalInfo.features.value.genus
	) {
		return lexicalInfo.features.value.genus;
	}

	if (
		lexicalInfo.inflections.status === "ready" &&
		lexicalInfo.inflections.value.kind === "noun"
	) {
		return lexicalInfo.inflections.value.genus;
	}

	if (lexicalInfo.core.status === "ready") {
		return lexicalInfo.core.value.nounIdentity?.genus;
	}

	return undefined;
}

export function dispatchHeaderFormatter(
	lexicalInfo: LexicalInfo,
	targetLanguage: string,
): string {
	const output = resolveHeaderCore(lexicalInfo);

	if (
		lexicalInfo.lemma.linguisticUnit === "Lexem" &&
		lexicalInfo.lemma.posLikeKind === "Noun"
	) {
		const nounGenus = resolveNounGenus(lexicalInfo);
		if (nounGenus) {
			return formatNounHeader(
				output,
				lexicalInfo.lemma.lemma,
				targetLanguage,
				nounGenus,
			);
		}
	}

	return formatCommonHeader(output, lexicalInfo.lemma.lemma, targetLanguage);
}
