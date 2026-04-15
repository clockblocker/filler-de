import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-X.html
const EnglishOtherExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);

const EnglishOtherInflectionalFeaturesSchema = featureSchema({});

const EnglishOtherInherentFeaturesSchema = featureSchema({
	extPos: EnglishOtherExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-X.html
	foreign: UniversalFeature.Foreign,
});

export const EnglishOtherSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishOtherInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishOtherInherentFeaturesSchema,
	pos: "X",
});
