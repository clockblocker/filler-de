import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../shared/english-common-enums";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

const EnglishCoordinatingConjunctionInflectionalFeaturesSchema = featureSchema(
	{},
);

const EnglishCoordinatingConjunctionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	polarity: EnglishFeature.Polarity.extract(["Neg"]), // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Polarity.html
});

export const EnglishCoordinatingConjunctionSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema:
		EnglishCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		EnglishCoordinatingConjunctionInherentFeaturesSchema,
	pos: "CCONJ",
});
