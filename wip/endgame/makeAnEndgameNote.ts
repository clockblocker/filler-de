import TextEaterPlugin from 'main';
import { MarkdownView, TFile } from 'obsidian';
import { getMaybeExistingNotePath } from './grundform/formatters/link';
import { compareGrundforms } from './grundform/formatters/match';
import { mergeGrundforms } from './grundform/formatters/mergeGrungforms';
import {
	Block,
	Grundform,
	GrundformsOutput,
	GrundformWithMatch,
	Match,
} from './zod/types';
import { formatGrundform } from './grundform/formatters/grundform';
import { makeMorphemBlock } from './common-blocks/morphems';
import { makeAdjektivBlock } from './grundform/wortart/adjektiv/makeAdjektivBlocks';
import { makeNewFileContent } from './note-block-management/new-note';
import { BlockId } from './note-block-management/types-and-constants';
import { setTimeout } from 'timers/promises';

async function endgameLinkCase(
	plugin: TextEaterPlugin,
	file: TFile,
	grundforms: GrundformWithMatch[]
): Promise<string> {
	const mergedGrundforms = mergeGrundforms(grundforms);
	mergedGrundforms.sort((a, b) => compareGrundforms(a, b));

	const formattedLinks = await Promise.all(
		mergedGrundforms.map(async (g) => {
			const path = await getMaybeExistingNotePath(plugin, file, g.grundform);
			return await formatGrundform(g, path);
		})
	);

	const groupedLinks = formattedLinks.reduce((acc, link, index) => {
		const currentGrundform = mergedGrundforms[index];
		const prevGrundform = index > 0 ? mergedGrundforms[index - 1] : null;

		if (prevGrundform && currentGrundform.wortart === prevGrundform.wortart) {
			acc[acc.length - 1] = acc[acc.length - 1] + ' | ' + link;
		} else {
			acc.push(link);
		}

		return acc;
	}, [] as string[]);

	return groupedLinks.join('\n');
}

async function endgameNoteCase(
	plugin: TextEaterPlugin,
	file: TFile,
	exactMatches: Grundform[]
): Promise<string> {
	const blocks: Block[] = [];

	const morphemBlock = await makeMorphemBlock(
		plugin,
		file,
		exactMatches[0].grundform
	);
	const adjektivBlock = await makeAdjektivBlock(
		plugin,
		file,
		exactMatches[0].grundform
	);
	morphemBlock && blocks.push(morphemBlock);
	adjektivBlock && blocks.push(adjektivBlock);

	return blocks.map(({ repr }) => repr).join('\n\n---\n');
}

export async function makeAnEndgameNoteTest(
	plugin: TextEaterPlugin,
	file: TFile,
	word: string
): Promise<void> {
	const { content: oldContent, error } =
		await plugin.fileService.readFileContentByPath(file.path);
	if (error) {
		return;
	}

	plugin.fileService.showLoadingOverlay();

	const newContent = await makeNewFileContent({
		oldFileContent: oldContent,
		newBlockContentFromId: {
			[BlockId.Tags]: '#Tag1/subtag #Tag2/another_subtag',
		},
	});

	await plugin.fileService.replaceContentInCurrentlyOpenedFile(
		file.path,
		newContent
	);

	await sleep(2000);

	plugin.fileService.hideLoadingOverlay();
}

export async function makeAnEndgameNote(
	plugin: TextEaterPlugin,
	file: TFile,
	output: GrundformsOutput,
	word: string
): Promise<void> {

	const allParts = await Promise.all(
		Object.entries(output).map(([match, grundforms]) => {
			if (match === Match.Grundform) {
				return endgameNoteCase(plugin, file, grundforms);
			} else {
				return endgameLinkCase(
					plugin,
					file,
					grundforms.map((g) => ({ ...g, match: match as Match }))
				);
			}
		})
	);

	const { content: oldContent, error } =
		await plugin.fileService.readFileContentByPath(file.path);
	if (error) {
		return;
	}

	await plugin.fileService.replaceContentInCurrentlyOpenedFile(
		file.path,
		'asdsad'
	);
}
