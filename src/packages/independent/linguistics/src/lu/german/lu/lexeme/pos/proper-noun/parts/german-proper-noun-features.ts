import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
import {
	GermanProperNounCase,
	GermanProperNounGender,
	GermanProperNounNumber,
} from "./german-proper-noun-enums";

export const GermanProperNounInflectionalFeaturesSchema = z
	.object({
		case: GermanProperNounCase.optional(),
		number: GermanProperNounNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PROPN">;

export const GermanProperNounInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		gender: GermanProperNounGender.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PROPN">;
