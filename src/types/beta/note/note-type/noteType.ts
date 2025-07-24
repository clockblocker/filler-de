import {
	CollocationStrength,
	LinguisticUnit,
	PHRASEM,
	PhrasemeType,
} from 'types/beta/general/consts/linguistics-consts';

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
