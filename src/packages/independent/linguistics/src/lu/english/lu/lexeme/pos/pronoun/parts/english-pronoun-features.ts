import z from "zod/v3";
import { IsPoss } from "../../../../../../universal/enums/feature/ud/poss";
import { IsReflex } from "../../../../../../universal/enums/feature/ud/reflex";
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
		reflex: IsReflex.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PRON">;

export const EnglishPronounInherentFeaturesSchema = z
	.object({
		person: EnglishPronounPerson.optional(),
		poss: IsPoss.optional(),
		pronType: EnglishPronounPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PRON">;
