import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishNumber } from "../../../shared/english-common-enums";
import { EnglishProperNounCase } from "./english-proper-noun-enums";

export const EnglishProperNounInflectionalFeaturesSchema = z
	.object({
		case: EnglishProperNounCase.optional(),
		number: EnglishNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PROPN">;

export const EnglishProperNounInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.Abbr.optional(),
		foreign: UniversalFeature.Foreign.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PROPN">;
