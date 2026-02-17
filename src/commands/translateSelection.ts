import { Editor, Notice } from 'obsidian';
import TextEaterPlugin from '../main';
import { prompts } from '../prompts';

export default async function translateSelection(
	plugin: TextEaterPlugin,
	editor: Editor,
	selection: string
) {
	try {
		const cursor = editor.getCursor();
		const response = await plugin.apiService.generateContent(prompts.translate_de_to_eng, selection);
		if (response) {
			editor.replaceSelection(selection + '\n\n' + response + '\n');
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch + selection.length,
			});
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
