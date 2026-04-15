import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

const EnglishInterjectionInflectionalFeaturesSchema = featureSchema({});

const EnglishInterjectionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	polarity: EnglishFeature.Polarity, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Polarity.html
	style: EnglishFeature.Style.extract(["Expr"]), // https://universaldependencies.org/u/feat/Style.html
});

export const EnglishInterjectionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishInterjectionInherentFeaturesSchema,
	pos: "INTJ",
});
