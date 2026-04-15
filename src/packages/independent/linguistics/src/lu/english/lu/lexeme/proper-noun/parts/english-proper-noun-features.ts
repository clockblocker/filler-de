import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishProperNounCase,
	EnglishProperNounNumber,
} from "./english-proper-noun-enums";

export const EnglishProperNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishProperNounCase.optional(),
		number: EnglishProperNounNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PROPN">;

export const EnglishProperNounInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PROPN">;
