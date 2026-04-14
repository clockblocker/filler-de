import { z } from "zod/v3";

const phrasemeKindValues = ["DiscourseFormula", "Cliché", "Aphorism"] as const;

// Source: local project phraseme taxonomy used by lexical-generation prompts.
export const PhrasemeKind = z.enum(phrasemeKindValues);
export type PhrasemeKind = z.infer<typeof PhrasemeKind>;
export const PHRASEME_KIND_KEY = "phrasemeKind";
export const PHRASEME_KINDS = PhrasemeKind.options;

const reprForPhrasemeKind = {
	Aphorism: "aphorism",
	Cliché: "Cliché",
	DiscourseFormula: "discourse formula",
} satisfies Record<PhrasemeKind, string>;

export function getReprForPhrasemeKind(phrasemeKind: PhrasemeKind) {
	return reprForPhrasemeKind[phrasemeKind];
}
