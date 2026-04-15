import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanDegree } from "../../../shared/german-common-enums";
import {
	GermanAdverbNumType,
	GermanAdverbPronType,
} from "./german-adverb-enums";

export const GermanAdverbInflectionalFeaturesSchema = z
	.object({
		degree: GermanDegree.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADV">;

export const GermanAdverbInherentFeaturesSchema = z
	.object({
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanAdverbNumType.optional(),
		pronType: GermanAdverbPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADV">;
