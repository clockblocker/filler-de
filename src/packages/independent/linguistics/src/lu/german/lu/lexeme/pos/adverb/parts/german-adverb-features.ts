import z from "zod/v3";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanAdverbDegree,
	GermanAdverbNumType,
	GermanAdverbPronType,
} from "./german-adverb-enums";

export const GermanAdverbInflectionalFeaturesSchema = z
	.object({
		degree: GermanAdverbDegree.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADV">;

export const GermanAdverbInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: GermanAdverbNumType.optional(),
		pronType: GermanAdverbPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADV">;
