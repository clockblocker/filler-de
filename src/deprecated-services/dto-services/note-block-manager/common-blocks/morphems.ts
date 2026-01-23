import type { TFile } from "obsidian";
import type TextEaterPlugin from "../../../../main";
import {
	formatPathToNoteAsLink,
	getPathsToGrundformNotes,
	getPathsToMorphemNotes,
} from "../../../prompts/endgame/grundform/formatters/link";
import { makeTagChain, Tag } from "../../../prompts/endgame/zod/consts";
import type {
	Backlink,
	Block,
	GrundformKerl,
	MorphemAnalysisOutput,
	MorphemKerl,
} from "../../../prompts/endgame/zod/types";

async function getZusammengesetztAusBlock(
	plugin: TextEaterPlugin,
	file: TFile,
	morphemAnalysis: MorphemAnalysisOutput,
): Promise<Block> {
	if (!morphemAnalysis.zusammengesetztAus) {
		return { backlinks: [], repr: "" };
	}

	const kerls = morphemAnalysis.zusammengesetztAus.map((r) => ({
		grundform: Object.keys(r)[0],
		wortart: Object.values(r)[0],
	}));

	const paths = await getPathsToGrundformNotes(
		plugin,
		file,
		kerls as GrundformKerl[],
	);

	const backlinks: Backlink[] = [];
	const reprs: string[] = [];

	for (let i = 0; i < kerls.length; i++) {
		backlinks.push({ path: paths[i] ?? "" });
		reprs.push(
			formatPathToNoteAsLink({
				noteExists: false,
				path: paths[i] ?? "",
				word: kerls[i]?.grundform ?? "",
			}),
		);
	}

	return { backlinks, repr: reprs.join(" + ") };
}

function getMorphemischeZerlegungBlock(
	morphemAnalysis: MorphemAnalysisOutput,
): Block {
	const kerls = morphemAnalysis.morphemischeZerlegung.map((r) => ({
		grundform: Object.keys(r)[0],
		morphem: Object.values(r)[0],
	}));

	const paths = getPathsToMorphemNotes(kerls as MorphemKerl[]);

	const backlinks: Backlink[] = [];
	const reprs: string[] = [];

	for (let i = 0; i < kerls.length; i++) {
		const tags = [makeTagChain([Tag.Morphem, kerls[i]?.morphem ?? ""])];
		backlinks.push({ path: paths[i] ?? "", tags });
		reprs.push(
			formatPathToNoteAsLink({
				noteExists: false,
				path: paths[i] ?? "",
				word: kerls[i]?.grundform ?? "",
			}),
		);
	}

	return { backlinks, repr: reprs.join("|") };
}

// export async function makeMorphemBlock(
// 	plugin: TextEaterPlugin,
// 	file: TFile,
// 	word: string
// ): Promise<{ repr: string; backlinks: Backlink[] } | null> {
// 	const prompt = promtMakerFromKeyword['Morphems']();
// 	const generatedMorphemAnalysisOutput =
// 		await plugin.apiService.generateContent(prompt, word, true);
// 	const parsedMorphemAnalysisOutput = morphemAnalysisOutputSchema.safeParse(
// 		JSON.parse(generatedMorphemAnalysisOutput)
// 	);

// 	if (parsedMorphemAnalysisOutput.error) {
// 		console.error({
// 			zodError: parsedMorphemAnalysisOutput.error,
// 			output: generatedMorphemAnalysisOutput,
// 		});
// 		await plugin.deprecatedFileService.writeToOpenedFile(
// 			file.path,
// 			'Contact t.me/@clockblocker'
// 		);
// 		return null;
// 	}

// 	const morphemAnalysis = parsedMorphemAnalysisOutput.data;
// 	const zusammengesetztAusBlock = await getZusammengesetztAusBlock(
// 		plugin,
// 		file,
// 		morphemAnalysis
// 	);
// 	const morphemischeZerlegungBlock =
// 		getMorphemischeZerlegungBlock(morphemAnalysis);

// 	return {
// 		repr: [morphemischeZerlegungBlock.repr, zusammengesetztAusBlock.repr].join(
// 			'\n'
// 		),
// 		backlinks: [
// 			...zusammengesetztAusBlock.backlinks,
// 			...morphemischeZerlegungBlock.backlinks,
// 		],
// 	};
// }
