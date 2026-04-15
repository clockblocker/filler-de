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
} from "../../../shared/german-common-enums";
import {
	GermanSymbolNumType,
} from "./german-symbol-enums";

export const GermanSymbolInflectionalFeaturesSchema = z
	.object({
		case: GermanCase.optional(),
		gender: GermanGender.optional(),
		number: GermanNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "SYM">;

export const GermanSymbolInherentFeaturesSchema = z
	.object({
		foreign: UniversalFeature.IsForeign.optional(),
		numType: GermanSymbolNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "SYM">;
