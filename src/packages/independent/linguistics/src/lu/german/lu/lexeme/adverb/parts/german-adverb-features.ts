import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanAdverbDegree,
	GermanAdverbNumType,
	GermanAdverbPronType,
} from "./german-adverb-enums";

export const GermanAdverbInflectionalFeaturesSchema = z
	.object({
		degree: GermanAdverbDegree.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"ADV"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanAdverbInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: GermanAdverbNumType.optional(),
		pronType: GermanAdverbPronType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "ADV">["inherentFeatures"]
>;
