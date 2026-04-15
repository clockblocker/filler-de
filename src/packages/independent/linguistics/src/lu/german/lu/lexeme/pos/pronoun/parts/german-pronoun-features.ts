import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanPronounCase,
	GermanPronounGender,
	GermanPronounNumber,
	GermanPronounPerson,
	GermanPronounPolite,
	GermanPronounPronType,
} from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = z
	.object({
		case: GermanPronounCase.optional(),
		gender: GermanPronounGender.optional(),
		number: GermanPronounNumber.optional(),
		reflex: UniversalFeature.IsReflex.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PRON">;

export const GermanPronounInherentFeaturesSchema = z
	.object({
		person: GermanPronounPerson.optional(),
		polite: GermanPronounPolite.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: GermanPronounPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PRON">;
