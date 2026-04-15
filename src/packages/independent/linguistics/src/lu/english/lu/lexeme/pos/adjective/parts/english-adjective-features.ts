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
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishAdjectiveInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree.optional(),
});

export const EnglishAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishAdjectiveExtPos.optional(),
	numForm: EnglishAdjectiveNumForm.optional(),
	numType: EnglishAdjectiveNumType.optional(),
	style: EnglishAdjectiveStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
