import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsPoss } from "../../../../../universal/enums/feature/ud/poss";
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
		poss: IsPoss.optional(),
		pronType: EnglishDeterminerPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "DET">;
