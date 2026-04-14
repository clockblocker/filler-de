import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishAdverbDegree,
	EnglishAdverbNumType,
	EnglishAdverbPronType,
} from "./english-adverb-enums";

export const EnglishAdverbInflectionalFeaturesSchema = z
	.object({
		degree: EnglishAdverbDegree.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"ADV"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishAdverbInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: EnglishAdverbNumType.optional(),
		pronType: EnglishAdverbPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "ADV">["inherentFeatures"]
>;
