import { z } from "zod/v3";

const verbFormValues = [
	"Conv",
	"Fin",
	"Gdv",
	"Ger",
	"Inf",
	"Part",
	"Sup",
	"Vnoun",
] as const;

// Source: https://universaldependencies.org/u/feat/VerbForm.html
export const VerbForm = z.enum(verbFormValues);
export type VerbForm = z.infer<typeof VerbForm>;

const verbFormRepr = {
	Conv: "converb, transgressive, adverbial participle, verbal adverb",
	Fin: "finite verb",
	Gdv: "gerundive",
	Ger: "gerund",
	Inf: "infinitive",
	Part: "participle, verbal adjective",
	Sup: "supine",
	Vnoun: "verbal noun, masdar",
} satisfies Record<VerbForm, string>;

export function reprForVerbForm(verbForm: VerbForm) {
	return verbFormRepr[verbForm];
}
