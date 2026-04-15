import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
	EnglishPerson,
} from "../../../shared/english-common-enums";
import { EnglishPronounPronType } from "./english-pronoun-enums";

export const EnglishPronounInflectionalFeaturesSchema = z
	.object({
		case: EnglishCase.optional(),
		gender: EnglishGender.optional(),
		number: EnglishNumber.optional(),
		reflex: UniversalFeature.IsReflex.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PRON">;

export const EnglishPronounInherentFeaturesSchema = z
	.object({
		person: EnglishPerson.optional(),
		poss: UniversalFeature.IsPoss.optional(),
		pronType: EnglishPronounPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PRON">;
