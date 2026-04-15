import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../shared/german-common-enums";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanSymbolNumType = UniversalFeature.NumType.extract(["Card", "Range"]);

const GermanSymbolInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

const GermanSymbolInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign,
	numType: GermanSymbolNumType,
});

export const GermanSymbolSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanSymbolInherentFeaturesSchema,
	pos: "SYM",
});
