import {
	CollocationStrength,
	LinguisticUnitType,
	PHRASEM,
	PhrasemeType,
} from 'types/beta/consts/linguistics-consts';

const noteTree = {
	[LinguisticUnitType.Phrasem]: {
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

