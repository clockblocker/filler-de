import type TextEaterPlugin from "main";
import type { TFile } from "obsidian";
import {
	type GrundformKerl,
	Match,
	type MorphemKerl,
	Wortart,
} from "prompts/endgame/zod/types";

export async function getMaybeExistingNotePath(
	plugin: TextEaterPlugin,
	file: TFile,
	word: string,
) {
	const targetFile = await plugin.app.metadataCache.getFirstLinkpathDest(
		word,
		file.path,
	);
	return targetFile ? targetFile.path : null;
}

export const grundformWortartFromGrundform = (g: GrundformKerl) => {
	return g.wortart;
};

export const getPathToNote = ({
	word,
	wortart,
	match,
	maybeExisitingNotePath,
}: {
	word: string;
	wortart: Wortart;
	match: Match;
	maybeExisitingNotePath: string | null;
}) => {
	const noteExists = maybeExisitingNotePath !== null;

	if (word.length < 2) {
		return noteExists ? `${maybeExisitingNotePath}|${word}` : "";
	}

	switch (wortart) {
		case Wortart.Unbekannt:
			return "";
		case Wortart.Praefix:
			return `Grammatik/Morphem/${wortart}/List/${word} (${wortart})`;
		case Wortart.Praeposition:
			return `Grammatik/${wortart}/List/${word} (${wortart})`;
		case Wortart.Pronomen:
			return `Grammatik/${wortart}/List/${word} (${wortart})`;
		case Wortart.Konjunktion:
			return `Grammatik/${wortart}/List/${word} (${wortart})`;
		case Wortart.Partikel:
			return `Grammatik/${wortart}/List/${word} (${wortart})`;
		case Wortart.Artikel:
			return `Grammatik/${wortart}/List/${word} (${wortart})`;
		default:
			return noteExists
				? `${maybeExisitingNotePath}`
				: `Worter/${match}/${wortart}/${word[0]}/${word[1]}/${word}`;
	}
};

export function formatPathToNoteAsLink({
	word,
	path,
	noteExists,
}: {
	word: string;
	path: string;
	noteExists: boolean;
}) {
	if (!path) {
		return "";
	}
	if (noteExists) {
		return `[[${word}]]`;
	}
	return `[[${path}|${word}]]`;
}

export async function getFormatLinkToGrundformNote(
	g: GrundformKerl,
	maybeExisitingNotePath: string | null,
) {
	const path = getPathToNote({
		word: g.grundform,
		wortart: g.wortart,
		match: Match.Grundform,
		maybeExisitingNotePath,
	});
	return formatPathToNoteAsLink({
		word: g.grundform,
		path,
		noteExists: !!maybeExisitingNotePath,
	});
}

export async function getPathsToGrundformNotes(
	plugin: TextEaterPlugin,
	file: TFile,
	kerls: GrundformKerl[],
) {
	const pathsPromises = kerls.map(async (g) => {
		const maybeExisitingNotePath = await getMaybeExistingNotePath(
			plugin,
			file,
			g.grundform,
		);
		return await getPathToNote({
			word: g.grundform,
			wortart: g.wortart,
			match: Match.Grundform,
			maybeExisitingNotePath,
		});
	});

	return await Promise.all(pathsPromises);
}

export async function getPathsToNotes(
	plugin: TextEaterPlugin,
	file: TFile,
	matchedKerls: (GrundformKerl & { match: Match })[],
) {
	const pathsPromises = matchedKerls.map(async (g) => {
		const maybeExisitingNotePath = await getMaybeExistingNotePath(
			plugin,
			file,
			g.grundform,
		);
		return await getPathToNote({
			word: g.grundform,
			wortart: g.wortart,
			match: g.match,
			maybeExisitingNotePath,
		});
	});

	return await Promise.all(pathsPromises);
}

export function getPathsToMorphemNotes(kerls: MorphemKerl[]) {
	return kerls.map(
		(k) =>
			`Grammatik/Morphem/${k.morphem}/List/${k.grundform[0]}/${k.grundform} (${k.morphem})`,
	);
}
