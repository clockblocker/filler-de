import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishAdjectiveExtPos,
	EnglishAdjectiveNumForm,
	EnglishAdjectiveNumType,
	EnglishAdjectiveStyle,
} from "./english-adjective-enums";

export const EnglishAdjectiveInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Degree.html
});

export const EnglishAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdjectiveExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
	numForm: EnglishAdjectiveNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishAdjectiveNumType, // https://universaldependencies.org/u/feat/NumType.html
	style: EnglishAdjectiveStyle, // https://universaldependencies.org/u/feat/Style.html
});
