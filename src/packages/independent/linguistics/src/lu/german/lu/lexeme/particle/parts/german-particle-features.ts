import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import { GermanPolarity } from "../../shared/german-common-enums";

export const GermanParticleInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PART"
	>["surface"]["inflectionalFeatures"]
>;

export const GermanParticleInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		polarity: GermanPolarity.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PART">["inherentFeatures"]
>;
