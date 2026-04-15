import z from "zod/v3";
import { IsAbbr } from "../../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
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
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		polarity: EnglishPolarity.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PART">;
