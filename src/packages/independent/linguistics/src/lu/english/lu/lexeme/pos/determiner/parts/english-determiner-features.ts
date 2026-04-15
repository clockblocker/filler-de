import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishDefinite,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";
import {
	EnglishDeterminerNumType,
	EnglishDeterminerPronType,
} from "./english-determiner-enums";

export const EnglishDeterminerInflectionalFeaturesSchema = z
	.object({
		number: EnglishNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "DET">;

export const EnglishDeterminerInherentFeaturesSchema = z
	.object({
		definite: EnglishDefinite.optional(),
		numType: EnglishDeterminerNumType.optional(),
		person: EnglishPerson.optional(),
		poss: UniversalFeature.Poss.optional(),
		pronType: EnglishDeterminerPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "DET">;
