export const message = 'Uncomment this, when the endgame promps are ready';

// import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
// import TextEaterPlugin from '../main';
// import { grundformsOutputSchema } from '../prompts/wip/endgame/zod/schemas';
// import {
// 	Grundform,
// 	Wortart,
// 	Nomen,
// 	Genus,
// } from '../prompts/wip/endgame/zod/types';
// import { z } from 'zod/v4';
// import { makeGrundformsPrompt } from '../prompts/wip/endgame/grundform/wortart/grundforms/grundformsPrompt';
// import {
// 	makeAnEndgameNote,
// 	makeAnEndgameNoteTest,
// } from '../prompts/wip/endgame/makeAnEndgameNote';

// export async function endgame(
// 	plugin: TextEaterPlugin,
// 	editor: Editor,
// 	file: TFile
// ) {
// 	const word = file.basename.toLocaleLowerCase();
// 	try {
// 		const grundformsPrompt = makeGrundformsPrompt();
// 		const generatedGrundforms = await plugin.apiService.generateContent(
// 			grundformsPrompt,
// 			word,
// 			true
// 		);

// 		// Wrap the output in an object with the word as the key
// 		const wrappedOutput = { [word]: JSON.parse(generatedGrundforms) };
// 		const parsedGrungforms = grundformsOutputSchema.safeParse(
// 			wrappedOutput[word]
// 		);

// 		if (parsedGrungforms.error) {
// 			console.error({
// 				zodError: parsedGrungforms.error,
// 				output: generatedGrundforms,
// 			});
// 			await plugin.fileService.appendToFile(
// 				file.path,
// 				'Contact t.me/@clockblocker'
// 			);
// 			return;
// 		}

// 		await makeAnEndgameNote(plugin, file, parsedGrungforms.data, word);

// 		editor.setCursor({ line: 1, ch: 0 });
// 		editor.focus();
// 	} catch (error) {
// 		new Notice(`Error: ${JSON.stringify(error)}`);
// 	}
// }

// export async function testEndgame(
// 	plugin: TextEaterPlugin,
// 	editor: Editor,
// 	file: TFile
// ) {
// 	const word = file.basename.toLocaleLowerCase();
// 	try {
// 		await makeAnEndgameNoteTest(plugin, file, word);

// 		editor.setCursor({ line: 1, ch: 0 });
// 		editor.focus();
// 	} catch (error) {
// 		new Notice(`Error: ${JSON.stringify(error)}`);
// 	}
// }
