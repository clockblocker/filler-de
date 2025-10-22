import {
	Genus,
	Kasus,
	NomenDeklination,
	Numerus,
} from "prompts/endgame/zod/types";
import { formatPathToNoteAsLink } from "../../formatters/link";
import {
	type AllDeclensions,
	AllDeclensionsSchema,
	allDeclensionsKeys,
	type CaseDeclension,
	caseDeclensionKeys,
	type Declensions,
	declensionKeys,
	fromFromNomenDeklinationFromKasusFromCaseDeclension,
	type PathFromWort,
	pronomen,
	verbForms,
} from "./types-and-consts";

export function makeAllDeclensionsFromAdjektivstamm(
	roots: string[] | undefined,
): AllDeclensions | undefined {
	if (!roots) {
		return undefined;
	}
	const allDeclensions: any = {};
	for (const nomenDeklination of allDeclensionsKeys) {
		allDeclensions[nomenDeklination] = {};
		for (const kasus of declensionKeys) {
			allDeclensions[nomenDeklination][kasus] = {};
			for (const caseDec of caseDeclensionKeys) {
				const fromFromFromKasusFromCaseDeclension =
					fromFromNomenDeklinationFromKasusFromCaseDeclension[
						nomenDeklination
					];
				if (!fromFromFromKasusFromCaseDeclension) {
					continue;
				}
				const { artikel, agj: endung } =
					fromFromFromKasusFromCaseDeclension[kasus][caseDec][0];
				allDeclensions[nomenDeklination][kasus][caseDec] = roots.map(
					(root) => ({ artikel, agj: root + endung }),
				);
			}
		}
	}
	const parsedAllDeclensions = AllDeclensionsSchema.safeParse(allDeclensions);

	if (parsedAllDeclensions.error) {
		console.error(parsedAllDeclensions.error);
		return undefined;
	}
	return parsedAllDeclensions.data;
}

export function makeReprSentenceForRoot(
	root: string,
	pathFromWord: PathFromWort,
): string {
	const links = ["e", "er", "em", "es", "en"].map((endung) => {
		const word = root + endung;
		const path = pathFromWord?.[word];
		if (path === undefined) {
			return word;
		}
		return formatPathToNoteAsLink({ word, path, noteExists: false });
	});

	// "Die klein[e] Mutter und ein klein[er] Sohn gaben klein[em] Vater ein klein[es] Geschenk klein[en] Onkels";
	return `- *Die* ${links[0]} *Mutter und ein* ${links[1]} *Sohn gaben* ${links[2]} *Vater ein* ${links[3]} *Geschenk* ${links[4]} *Onkels*`;
}

export function getSentencesForAllDeclensions(d: AllDeclensions): string[][] {
	const cases: (keyof Declensions)[] = [Kasus.N, Kasus.D, Kasus.A, Kasus.G];
	const genders: (keyof CaseDeclension)[] = [
		Genus.M,
		Genus.F,
		Genus.N,
		Numerus.Mehrzahl,
	];

	const declensionTypes: (keyof AllDeclensions)[] = [
		NomenDeklination.Schwach,
		NomenDeklination.Gemischt,
		NomenDeklination.Stark,
	];

	const sentences: string[][] = [];

	for (const dt of declensionTypes) {
		const sentencesForDeclension = genders.map((gender) => {
			const listOfParts = cases
				.map((cas, idx) => {
					if (dt === undefined) {
						return [""];
					}

					const dDt = d[dt];
					if (dDt === undefined) {
						return [""];
					}

					const dDtCas = dDt[cas];
					if (dDtCas === undefined) {
						return [""];
					}

					const roots = dDtCas[gender];

					return roots.map((root) => {
						const adj = root.agj;
						const article = root.artikel;
						const noun = pronomen[gender][idx];
						return article
							? `*${article}* ${adj} *${noun}*`
							: `${adj} *${noun}*`;
					});
				})
				.filter((parts) => parts[0] !== "");

			const verb = verbForms[gender];

			const listOfFormattedSentences = listOfParts.map((parts) => {
				const [firstLetter, secondLetter, ...rest] = parts[0].split("");
				return `${firstLetter === "*" ? firstLetter + secondLetter.toLocaleUpperCase() : firstLetter.toLocaleUpperCase() + secondLetter}${rest.join("")} *${verb}* ${parts[1]} ${parts[2]} ${parts[3]}`;
			});

			return listOfFormattedSentences;
		});

		sentencesForDeclension.forEach((sentence) => sentences.push(sentence));
	}

	return sentences;
}
