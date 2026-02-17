import { Editor, Notice } from 'obsidian';
import TextEaterPlugin from '../main';
import { prompts } from '../prompts';

export default async function insertReplyFromKeymaker(
	plugin: TextEaterPlugin,
	editor: Editor,
	selection: string
) {
	try {
		const response = await plugin.apiService.generateContent(prompts.keymaker, selection);
		if (response) {
			editor.replaceSelection(selection + '\n' + response + '\n');
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
