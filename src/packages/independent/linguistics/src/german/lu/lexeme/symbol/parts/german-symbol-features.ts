import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanSymbolCase,
	GermanSymbolGender,
	GermanSymbolNumber,
	GermanSymbolNumType,
} from "./german-symbol-enums";

export const GermanSymbolInflectionalFeaturesSchema = z
	.object({
		case: GermanSymbolCase.optional(),
		gender: GermanSymbolGender.optional(),
		number: GermanSymbolNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"SYM"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanSymbolInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: GermanSymbolNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "SYM">["inherentFeatures"]
>;
