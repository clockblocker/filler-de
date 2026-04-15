import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
	GermanPerson,
	GermanPolite,
} from "../../../shared/german-common-enums";
import { GermanPronounPronType } from "./german-pronoun-enums";

export const GermanPronounInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		gender: GermanGender.optional(),
		number: GermanNumber.optional(),
		reflex: UniversalFeature.Reflex.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "PRON">;

export const GermanPronounInherentFeaturesSchema = z
	.object({
		person: GermanPerson.optional(),
		polite: GermanPolite.optional(),
		poss: UniversalFeature.Poss.optional(),
		pronType: GermanPronounPronType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "PRON">;
