import { Editor, Notice } from 'obsidian';
import TextEaterPlugin from '../../main';

export default async function translateSelection(
	plugin: TextEaterPlugin,
	editor: Editor,
	selection: string
) {
	try {
		const cursor = editor.getCursor();
		const response = await plugin.apiService.translateText(selection);
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
