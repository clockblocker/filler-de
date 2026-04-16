import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanNumeralNumType = UniversalFeature.NumType.extract([
	"Card",
	"Frac",
	"Mult",
	"Range",
]);

const GermanNumeralInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

const GermanNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	numType: GermanNumeralNumType,
});

export const GermanNumeralSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanNumeralInherentFeaturesSchema,
	pos: "NUM",
});
