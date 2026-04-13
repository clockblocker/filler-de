import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishSymbolCase,
	EnglishSymbolGender,
	EnglishSymbolNumber,
	EnglishSymbolNumType,
} from "./english-symbol-enums";

export const EnglishSymbolInflectionalFeaturesSchema = z
	.object({
		case: EnglishSymbolCase.optional(),
		gender: EnglishSymbolGender.optional(),
		number: EnglishSymbolNumber.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"SYM"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishSymbolInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: EnglishSymbolNumType.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "SYM">["inherentFeatures"]
>;
