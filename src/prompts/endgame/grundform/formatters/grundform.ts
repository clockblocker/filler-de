import {
	Genus,
	Grundform,
	GrundformWithMatch,
	Nomen,
	Wortart,
} from 'prompts/endgame/zod/types';
import { getFormatLinkToGrundformNote } from './link';
import { formatMatch } from './match';

const nomenativeArticleFromGenus = {
	[Genus.F]: 'die',
	[Genus.N]: 'das',
	[Genus.M]: 'der',
};

const formatNomGenus = ({ genus: g }: Nomen) => {
	return `<span class="custom-color-for-${nomenativeArticleFromGenus[g]}">${nomenativeArticleFromGenus[g]}</span>`;
};

const formatEmojiBeschreibungs = (g: Grundform) =>
	`${g.emojiBeschreibungs.join(' | ')}`;

const formattedWortartFromGrundform = (g: Grundform) => {
	const w = g.wortart;
	if (w === Wortart.Nomen) {
		return formatNomGenus(g);
	}
	return `*${w}*`;
};

export async function formatGrundform(
	g: GrundformWithMatch,
	grundformNotePath: string | null
): Promise<string> {
	return [
		formatMatch(g),
		formattedWortartFromGrundform(g),
		formatEmojiBeschreibungs(g),
		await getFormatLinkToGrundformNote(g, grundformNotePath),
	]
		.filter((a) => a)
		.join(' ');
}
