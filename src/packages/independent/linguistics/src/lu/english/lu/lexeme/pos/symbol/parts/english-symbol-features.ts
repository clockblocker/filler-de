import z from "zod/v3";
import { IsForeign } from "../../../../../../universal/enums/feature/ud/foreign";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishSymbolCase,
	EnglishSymbolGender,
	EnglishSymbolNumber,
	EnglishSymbolNumType,
} from "./english-symbol-enums";

export const EnglishSymbolInflectionalFeaturesSchema = z
	.object({
		case: EnglishSymbolCase.optional(),
		gender: EnglishSymbolGender.optional(),
		number: EnglishSymbolNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "SYM">;

export const EnglishSymbolInherentFeaturesSchema = z
	.object({
		foreign: IsForeign.optional(),
		numType: EnglishSymbolNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "SYM">;
