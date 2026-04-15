import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishPronounCase,
	EnglishPronounGender,
	EnglishPronounNumber,
	EnglishPronounPerson,
	EnglishPronounPronType,
} from "./english-pronoun-enums";

export const EnglishPronounInflectionalFeaturesSchema = z
	.object({
		case: EnglishPronounCase.optional(),
		gender: EnglishPronounGender.optional(),
		number: EnglishPronounNumber.optional(),
		reflex: UniversalFeature.IsReflex.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PRON">;

export const EnglishPronounInherentFeaturesSchema = z
	.object({
		person: EnglishPronounPerson.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: EnglishPronounPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PRON">;
