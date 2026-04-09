import z from "zod";

const lexicalRelations = [
	"Synonym",
	"NearSynonym",
	"Antonym",
	"Hypernym",
	"Hyponym",
	"Meronym",
	"Holonym",
] as const;

export const LexicalRelation = z.enum(lexicalRelations);
export type LexicalRelation = z.infer<typeof LexicalRelation>;

const lexicalRelationRepr = {
	Antonym: "≠",
	Holonym: "∋",
	Hypernym: "⊃",
	Hyponym: "⊂",
	Meronym: "∈",
	NearSynonym: "≈",
	Synonym: "=",
} satisfies Record<LexicalRelation, string>;

export function reprForLexicalRelation(lexicalRelation: LexicalRelation) {
	return lexicalRelationRepr[lexicalRelation];
}
