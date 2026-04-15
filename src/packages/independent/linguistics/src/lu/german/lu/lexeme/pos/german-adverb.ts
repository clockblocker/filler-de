import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../shared/german-common-enums";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanAdverbNumType = UniversalFeature.NumType.extract(["Card", "Mult"]);

const GermanAdverbPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rel",
]);

const GermanAdverbInflectionalFeaturesSchema = featureSchema({
	degree: GermanFeature.Degree,
});

const GermanAdverbInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign,
	numType: GermanAdverbNumType,
	pronType: GermanAdverbPronType,
});

export const GermanAdverbSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdverbInherentFeaturesSchema,
	pos: "ADV",
});
