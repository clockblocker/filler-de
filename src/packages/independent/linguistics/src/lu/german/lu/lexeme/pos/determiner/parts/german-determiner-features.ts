import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanDeterminerCase,
	GermanDeterminerDefinite,
	GermanDeterminerDegree,
	GermanDeterminerGender,
	GermanDeterminerNumber,
	GermanDeterminerNumType,
	GermanDeterminerPerson,
	GermanDeterminerPolite,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = z
	.object({
		case: GermanDeterminerCase.optional(),
		degree: GermanDeterminerDegree.optional(),
		gender: GermanDeterminerGender.optional(),
		number: GermanDeterminerNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "DET">;

export const GermanDeterminerInherentFeaturesSchema = z
	.object({
		definite: GermanDeterminerDefinite.optional(),
		numType: GermanDeterminerNumType.optional(),
		person: GermanDeterminerPerson.optional(),
		polite: GermanDeterminerPolite.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: GermanDeterminerPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "DET">;
