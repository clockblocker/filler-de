import { z } from "zod/v3";

const phrasemeKindValues = [
	"DiscourseFormula",
	"Aphorism",
	"Proverb",
	"Idiom",
] as const;

// Source: local project phraseme taxonomy used by lexical-generation prompts.
export const PhrasemeKind = z.enum(phrasemeKindValues);
export type PhrasemeKind = z.infer<typeof PhrasemeKind>;
export const PHRASEME_KIND_KEY = "phrasemeKind";

const PHRASEME_KINDS = PhrasemeKind.options;

const reprForPhrasemeKind = {
	Aphorism: "aphorism",
	DiscourseFormula: "discourse formula",
	Idiom: "idiom",
	Proverb: "proverb",
} satisfies Record<PhrasemeKind, string>;

function getReprForPhrasemeKind(phrasemeKind: PhrasemeKind) {
	return reprForPhrasemeKind[phrasemeKind];
}
