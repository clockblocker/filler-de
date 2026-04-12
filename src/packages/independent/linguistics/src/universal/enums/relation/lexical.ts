import { z } from "zod/v3";

const lexicalRelations = [
	"synonym",
	"nearSynonym",
	"antonym",
	"hypernym",
	"hyponym",
	"meronym",
	"holonym",
] as const;

export const LexicalRelation = z.enum(lexicalRelations);
export type LexicalRelation = z.infer<typeof LexicalRelation>;

const inverseLexicalRelation = {
	antonym: "antonym",
	holonym: "meronym",
	hypernym: "hyponym",
	hyponym: "hypernym",
	meronym: "holonym",
	nearSynonym: "nearSynonym",
	synonym: "synonym",
} as const satisfies Record<LexicalRelation, LexicalRelation>;

const reprForLexicalRelation = {
	antonym: "!=",
	holonym: "∋",
	hypernym: "⊃",
	hyponym: "⊂",
	meronym: "∈",
	nearSynonym: "≈",
	synonym: "=",
} as const satisfies Record<LexicalRelation, string>;

export function getInverseLexicalRelation(
	lexicalRelation: LexicalRelation,
): LexicalRelation {
	return inverseLexicalRelation[lexicalRelation];
}

export function getReprForLexicalRelation(lexicalRelation: LexicalRelation) {
	return reprForLexicalRelation[lexicalRelation];
}
