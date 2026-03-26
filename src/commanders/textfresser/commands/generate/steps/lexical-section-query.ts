import type {
	LexicalGenus,
	LexicalInfo,
	LexicalNounIdentity,
} from "../../../../../lexical-generation";
import type { DictEntry } from "../../../domain/dict-note/types";

type LexemLexicalInfo = Extract<
	LexicalInfo,
	{ lemma: { linguisticUnit: "Lexem" } }
>;

type LexicalSectionQuery =
	| {
			unit: "Lexem";
			pos: LexemLexicalInfo["lemma"]["posLikeKind"];
			nounClass?: LexicalNounIdentity["nounClass"];
	  }
	| { unit: "Phrasem" };

export function resolveLexemNounIdentity(
	lexicalInfo: LexemLexicalInfo,
): LexicalNounIdentity | undefined {
	if (lexicalInfo.lemma.posLikeKind !== "Noun") {
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

function resolveStoredNounIdentity(
	entry: DictEntry,
): LexicalNounIdentity | undefined {
	const linguisticUnit = entry.meta.linguisticUnit;
	if (
		linguisticUnit?.kind === "Lexem" &&
		linguisticUnit.surface.features.pos === "Noun"
	) {
		const { features } = linguisticUnit.surface;
		if ("nounClass" in features || "genus" in features) {
			return {
				genus: "genus" in features ? features.genus : undefined,
				nounClass: "nounClass" in features ? features.nounClass : undefined,
			};
		}
	}

	const entity = entry.meta.entity;
	if (
		entity?.linguisticUnit === "Lexem" &&
		entity.posLikeKind === "Noun" &&
		"nounClass" in entity.features.lexical
	) {
		return {
			genus:
				"genus" in entity.features.lexical
					? entity.features.lexical.genus
					: undefined,
			nounClass: entity.features.lexical.nounClass,
		};
	}

	return undefined;
}

export function buildStoredSectionQuery(params: {
	entry: DictEntry;
	lemma: LexicalInfo["lemma"];
}): LexicalSectionQuery {
	const { entry, lemma } = params;
	if (lemma.linguisticUnit === "Lexem") {
		return {
			nounClass:
				lemma.posLikeKind === "Noun"
					? resolveStoredNounIdentity(entry)?.nounClass
					: undefined,
			pos: lemma.posLikeKind,
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
