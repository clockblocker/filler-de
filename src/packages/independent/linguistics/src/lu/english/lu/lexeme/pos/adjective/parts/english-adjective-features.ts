import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishAdjectiveExtPos,
	EnglishAdjectiveNumForm,
	EnglishAdjectiveNumType,
	EnglishAdjectiveStyle,
} from "./english-adjective-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishAdjectiveInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree,
});

export const EnglishAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdjectiveExtPos,
	numForm: EnglishAdjectiveNumForm,
	numType: EnglishAdjectiveNumType,
	style: EnglishAdjectiveStyle,
});
