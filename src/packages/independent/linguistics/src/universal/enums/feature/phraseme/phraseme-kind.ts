import { z } from "zod/v3";

const phrasemeKindValues = [
	"Collocation",
	"CulturalQuotation",
	"Idiom",
	"Proverb",
] as const;

// Source: local project phraseme taxonomy used by lexical-generation prompts.
export const PhrasemeKind = z.enum(phrasemeKindValues);
export type PhrasemeKind = z.infer<typeof PhrasemeKind>;
export const PHRASEME_KIND_KEY = "phrasemeKind";

const reprForPhrasemeKind = {
	Collocation: "collocation",
	CulturalQuotation: "cultural quotation",
	Idiom: "idiom",
	Proverb: "proverb",
} satisfies Record<PhrasemeKind, string>;

export function getReprForPhrasemeKind(phrasemeKind: PhrasemeKind) {
	return reprForPhrasemeKind[phrasemeKind];
}
