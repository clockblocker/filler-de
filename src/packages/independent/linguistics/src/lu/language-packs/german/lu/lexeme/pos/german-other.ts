import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanOtherNumType = UniversalFeature.NumType.extract([
	"Card",
	"Mult",
	"Range",
]);

const GermanOtherInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	mood: GermanFeature.Mood,
	number: GermanFeature.Number,
	verbForm: GermanFeature.VerbForm,
});

const GermanOtherInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	hyph: UniversalFeature.Hyph,
	numType: GermanOtherNumType,
});

export const GermanOtherSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanOtherInherentFeaturesSchema,
	pos: "X",
});
