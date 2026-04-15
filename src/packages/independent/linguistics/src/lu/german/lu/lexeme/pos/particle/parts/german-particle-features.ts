import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanPolarity } from "../../../shared/german-common-enums";

export const GermanParticleInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PART">;

export const GermanParticleInherentFeaturesSchema = z
	.object({
		abbr: UniversalFeature.Abbr.optional(),
		foreign: UniversalFeature.Foreign.optional(),
		polarity: GermanPolarity.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PART">;
