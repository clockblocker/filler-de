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
} from "../../../shared/english-common-enums";
import {
	EnglishSymbolNumType,
} from "./english-symbol-enums";

export const EnglishSymbolInflectionalFeaturesSchema = z
	.object({
		case: EnglishCase.optional(),
		gender: EnglishGender.optional(),
		number: EnglishNumber.optional(),
	})
	.strict() satisfies InflectionalFeaturesSchemaFor<"Lexeme", "SYM">;

export const EnglishSymbolInherentFeaturesSchema = z
	.object({
		foreign: UniversalFeature.IsForeign.optional(),
		numType: EnglishSymbolNumType.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme", "SYM">;
