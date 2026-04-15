import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishDeterminerDefinite,
	EnglishDeterminerNumber,
	EnglishDeterminerNumType,
	EnglishDeterminerPerson,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = z
	.object({
		number: EnglishDeterminerNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "DET">;

export const EnglishDeterminerInherentFeaturesSchema = z
	.object({
		definite: EnglishDeterminerDefinite.optional(),
		numType: EnglishDeterminerNumType.optional(),
		person: EnglishDeterminerPerson.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: EnglishDeterminerPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "DET">;
