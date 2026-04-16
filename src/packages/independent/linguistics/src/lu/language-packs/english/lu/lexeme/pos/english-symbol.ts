import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SYM.html
const EnglishSymbolExtPos = UniversalFeature.ExtPos.extract(["ADP", "PROPN"]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishSymbolNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	number: EnglishSymbolNumber,
});

const EnglishSymbolInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishSymbolExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SYM.html
});

export const EnglishSymbolSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishSymbolInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishSymbolInherentFeaturesSchema,
	pos: "SYM",
});
