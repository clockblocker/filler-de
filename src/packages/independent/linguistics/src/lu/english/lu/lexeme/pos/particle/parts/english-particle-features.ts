import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishPolarity } from "../../../shared/english-common-enums";

export const EnglishParticleInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PART">;

export const EnglishParticleInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.IsAbbr.optional(),
		foreign: UniversalFeature.IsForeign.optional(),
		polarity: EnglishPolarity.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PART">;
