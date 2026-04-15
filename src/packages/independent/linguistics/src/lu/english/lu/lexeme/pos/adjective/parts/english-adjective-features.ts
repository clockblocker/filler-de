import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishDegree } from "../../../shared/english-common-enums";
import { EnglishAdjectiveNumType } from "./english-adjective-enums";

export const EnglishAdjectiveInflectionalFeaturesSchema = z
	.object({
		degree: EnglishDegree.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "ADJ">;

export const EnglishAdjectiveInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.Abbr.optional(),
		foreign: UniversalFeature.Foreign.optional(),
		numType: EnglishAdjectiveNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "ADJ">;
