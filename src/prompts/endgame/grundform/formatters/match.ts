import { Grundform, GrundformWithMatch, Match, Wortart } from '../../zod/types';

export const matchScoreFromMatch: Record<Match, number> = {
	[Match.Grundform]: 2,
	[Match.Flexion]: 1,
	[Match.Tippfehler]: 0,
	[Match.Unbekannt]: -1,
};

export const reprFromMatch: Record<Match, string> = {
	[Match.Grundform]: '',
	[Match.Flexion]: 'Flexion',
	[Match.Tippfehler]: 'Tippfehler',
	[Match.Unbekannt]: 'Unbekannt',
};

export const formatMatch = ({ wortart, match }: GrundformWithMatch) => {
	const repr = wortart === Wortart.Unbekannt ? '' : reprFromMatch[match];
	return repr ? `*${repr}*` : repr;
};

export function compareGrundforms(
	a: GrundformWithMatch,
	b: GrundformWithMatch
): number {
	const aScore = matchScoreFromMatch[a.match];
	const bScore = matchScoreFromMatch[b.match];

	return bScore - aScore;
}

