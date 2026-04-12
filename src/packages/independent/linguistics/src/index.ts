import z from "zod/v3";
import { GermanLemmaSchema } from "./german/german-lemma";
import { GermanSelectionSchema } from "./german/german-selection";
import type {
	LemmaSchemaLanguageShape,
	SelectionSchemaLanguageShape,
} from "./registry-shapes";

const supportedTargetLanguages = ["German"] as const;

const TargetLang = z.enum(supportedTargetLanguages);
type TargetLang = z.infer<typeof TargetLang>;

type SelectionSchemaShape = {
	[L in TargetLang]: SelectionSchemaLanguageShape;
};

export const SelectionSchema = {
	German: GermanSelectionSchema,
} satisfies SelectionSchemaShape;

type LemmaSchemaShape = {
	[L in TargetLang]: LemmaSchemaLanguageShape;
};

export const LemmaSchema = {
	German: GermanLemmaSchema,
} satisfies LemmaSchemaShape;
