import z from "zod/v3";
import type {
	InherentFeaturesSchemaFor,
	InflectionalFeaturesSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { IsForeign } from "../../../../../universal/enums/feature/ud/foreign";
import {
	GermanSymbolCase,
	GermanSymbolGender,
	GermanSymbolNumber,
	GermanSymbolNumType,
} from "./german-symbol-enums";

export const GermanSymbolInflectionalFeaturesSchema = z
	.object({
		case: GermanSymbolCase.optional(),
		gender: GermanSymbolGender.optional(),
		number: GermanSymbolNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "SYM">;

export const GermanSymbolInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: GermanSymbolNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "SYM">;
