import {
  CollocationStrength,
  LinguisticUnit,
  PhrasemeType,
} from "../../linguistics/general-linguistic-enums/linguistics-enums";

const noteTree = {
  [LinguisticUnit.Phrasem]: {
    [PhrasemeType.Collocation]: {},
    [PhrasemeType.CulturalQuotation]: {},
    [PhrasemeType.DiscourseFormula]: {},
    [PhrasemeType.Idiom]: {},
    [PhrasemeType.Proverb]: {},
  },
};

export const weightFromCollocationStrength = {
  [CollocationStrength.Free]: 0,
  [CollocationStrength.Bound]: 1,
  [CollocationStrength.Frozen]: 3,
} as const;
