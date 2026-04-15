import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanDefinite,
	GermanDegree,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../../shared/german-common-enums";
import {
	GermanDeterminerNumType,
	GermanDeterminerPronType,
} from "./german-determiner-enums";

export const GermanDeterminerInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		degree: GermanDegree.optional(),
		gender: GermanGender.optional(),
		number: GermanNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "DET">;

export const GermanDeterminerInherentFeaturesSchema = z
	.object({
		definite: GermanDefinite.optional(),
		numType: GermanDeterminerNumType.optional(),
		person: GermanPerson.optional(),
		polite: GermanPolite.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: GermanDeterminerPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "DET">;
