import { Editor, Notice } from 'obsidian';
import TextEaterPlugin from '../main';
import { cleanMarkdownFormatting } from './functions';

export default async function insertReplyFromC1Richter(
	plugin: TextEaterPlugin,
	editor: Editor,
	selection: string
) {
	const notice = new Notice('Generating…', 0);
	try {
		const response = await plugin.apiService.consultC1Richter(
			cleanMarkdownFormatting(selection)
		);
		if (response) {
			editor.replaceSelection(selection + '\n' + response.trim());
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	} finally {
		notice.hide();
	}
}
