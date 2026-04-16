import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanAdjectiveNumType = UniversalFeature.NumType.extract([
	"Card",
	"Ord",
]);

const GermanAdjectiveInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	degree: GermanFeature.Degree,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
});

const GermanAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	numType: GermanAdjectiveNumType,
	variant: UniversalFeature.Variant,
});

export const GermanAdjectiveSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdjectiveInherentFeaturesSchema,
	pos: "ADJ",
});
