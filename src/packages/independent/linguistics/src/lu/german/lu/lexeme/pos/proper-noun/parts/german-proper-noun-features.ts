import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
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
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		gender: GermanProperNounGender.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PROPN">;
