import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../main';

export default async function getInfinitiveAndEmoji(
	plugin: TextEaterPlugin,
	editor: Editor,
	file: TFile
) {
	const word = file.basename;

	try {
		let response = await plugin.apiService.determineInfinitiveAndEmoji(word);
		if (response) {
			response = response.replace(/^\n+/, '');
			response = response.trim();
			await plugin.deprecatedFileService.writeToOpenedFile(
				file.path,
				response + '\n'
			);
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
