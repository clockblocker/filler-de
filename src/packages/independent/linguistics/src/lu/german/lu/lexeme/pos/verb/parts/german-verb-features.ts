import z from "zod/v3";
import { UniversalFeature } from "../../../../../../universal/enums/feature";
import type {
	InflectionalFeaturesSchemaFor,
	InherentFeaturesSchemaFor,
} from "../../../../../../universal/helpers/schema-targets";
import { GermanVerbalInflectionalFeaturesSchema } from "../../../shared/german-verbal-inflection-features";

export const GermanVerbInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema satisfies InflectionalFeaturesSchemaFor<"Lexeme">;

export const GermanVerbInherentFeaturesSchema = z
	.object({
		governedPreposition: UniversalFeature.GovernedPreposition.optional(),
		lexicallyReflexive: UniversalFeature.LexicallyReflexive.optional(),
		separable: UniversalFeature.Separable.optional(),
	})
	.strict() satisfies InherentFeaturesSchemaFor<"Lexeme">;
