import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../main';
import { prompts } from '../prompts';

export default async function getInfinitiveAndEmoji(
	plugin: TextEaterPlugin,
	editor: Editor,
	file: TFile
) {
	const word = file.basename;

	try {
		let response = await plugin.apiService.generateContent(prompts.determine_infinitive_and_pick_emoji, word);
		if (response) {
			response = response.replace(/^\n+/, '');
			response = response.trim();
			await plugin.fileService.writeToOpenedFile(file.path, response + '\n');
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
