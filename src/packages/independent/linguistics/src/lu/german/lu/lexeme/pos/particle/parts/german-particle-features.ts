import z from "zod/v3";
import { IsAbbr } from "../../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
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
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		polarity: GermanPolarity.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PART">;
