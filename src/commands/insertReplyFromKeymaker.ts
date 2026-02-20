import { Editor, Notice } from 'obsidian';
import TextEaterPlugin from '../main';

export default async function insertReplyFromKeymaker(
	plugin: TextEaterPlugin,
	editor: Editor,
	selection: string
) {
	const notice = new Notice('Generating…', 0);
	try {
		const response = await plugin.apiService.consultKeymaker(selection);
		if (response) {
			editor.replaceSelection(selection + '\n' + response + '\n');
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	} finally {
		notice.hide();
	}
}
