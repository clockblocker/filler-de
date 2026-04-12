import type {
	LexicalInfo,
	LexicalNounIdentity,
} from "@textfresser/lexical-generation";
import type { LexicalGenus } from "../../../domain/lexical-types";

type LexemLemma = Extract<LexicalInfo["lemma"], { linguisticUnit: "Lexem" }>;

type LexicalSectionQuery =
	| {
			unit: "Lexem";
			pos: LexemLemma["posLikeKind"];
			nounClass?: LexicalNounIdentity["nounClass"];
	  }
	| { unit: "Phrasem" };

export function resolveLexemNounIdentity(
	lexicalInfo: LexicalInfo,
): LexicalNounIdentity | undefined {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.lemma.posLikeKind !== "Noun"
	) {
		return undefined;
	}

	if (
		lexicalInfo.features.status === "ready" &&
		lexicalInfo.features.value.kind === "noun"
	) {
		return {
			genus: lexicalInfo.features.value.genus,
			nounClass: lexicalInfo.features.value.nounClass,
		};
	}

	if (lexicalInfo.core.status === "ready") {
		return lexicalInfo.core.value.nounIdentity;
	}

	return undefined;
}

export function buildLexicalSectionQuery(
	lexicalInfo: LexicalInfo,
): LexicalSectionQuery {
	if (lexicalInfo.lemma.linguisticUnit === "Lexem") {
		return {
			nounClass: resolveLexemNounIdentity(lexicalInfo)?.nounClass,
			pos: lexicalInfo.lemma.posLikeKind,
			unit: "Lexem",
		};
	}

	return { unit: "Phrasem" };
}

export function resolveNounInflectionGenus(
	lexicalInfo: LexicalInfo,
): LexicalGenus | undefined {
	if (
		lexicalInfo.lemma.linguisticUnit !== "Lexem" ||
		lexicalInfo.lemma.posLikeKind !== "Noun"
	) {
		return undefined;
	}

	if (
		lexicalInfo.inflections.status === "ready" &&
		lexicalInfo.inflections.value.kind === "noun"
	) {
		return lexicalInfo.inflections.value.genus;
	}

	if (
		lexicalInfo.features.status === "ready" &&
		lexicalInfo.features.value.kind === "noun"
	) {
		return lexicalInfo.features.value.genus;
	}

	return resolveLexemNounIdentity(lexicalInfo)?.genus;
}
