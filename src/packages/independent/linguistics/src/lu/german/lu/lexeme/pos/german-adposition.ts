import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanAdpositionInflectionalFeaturesSchema = featureSchema({});

const GermanAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	adpType: UniversalFeature.AdpType.extract(["Circ", "Post", "Prep"]),
	extPos: UniversalFeature.ExtPos.extract(["ADV", "SCONJ"]),
	foreign: UniversalFeature.Foreign,
	governedCase: UniversalFeature.GovernedCase,
	partType: UniversalFeature.PartType.extract(["Vbp"]),
});

export const GermanAdpositionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAdpositionInherentFeaturesSchema,
	pos: "ADP",
});
