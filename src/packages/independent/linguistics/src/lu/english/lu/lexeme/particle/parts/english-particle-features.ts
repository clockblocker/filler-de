import z from "zod/v3";
import type { AbstractLemma } from "../../../../../universal/abstract-lemma";
import type { AbstractSelectionFor } from "../../../../../universal/abstract-selection";
import { IsAbbr } from "../../../../../universal/enums/feature/ud/abbr";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import { EnglishPolarity } from "../../shared/english-common-enums";

export const EnglishParticleInflectionalFeaturesSchema = z
	.object({})
	.strict() satisfies z.ZodType<
	AbstractSelectionFor<
		"Standard",
		"Inflection",
		"Lexeme",
		"PART"
	>["surface"]["inflectionalFeatures"]
>;

export const EnglishParticleInherentFeaturesSchema = z
	.object({
		abbr: IsAbbr.optional(),
		foreign: IsForeign.optional(),
		polarity: EnglishPolarity.optional(),
	})
	.strict() satisfies z.ZodType<
	AbstractLemma<"Lexeme", "PART">["inherentFeatures"]
>;
