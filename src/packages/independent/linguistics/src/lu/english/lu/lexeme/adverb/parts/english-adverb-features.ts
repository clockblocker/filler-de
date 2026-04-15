import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	EnglishAdverbDegree,
	EnglishAdverbNumType,
	EnglishAdverbPronType,
} from "./english-adverb-enums";

export const EnglishAdverbInflectionalFeaturesSchema = z
	.object({
		degree: EnglishAdverbDegree.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADV">;

export const EnglishAdverbInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: EnglishAdverbNumType.optional(),
		pronType: EnglishAdverbPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADV">;
