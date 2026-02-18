import { Editor, Notice, TFile } from 'obsidian';
import TextEaterPlugin from '../main';

export default async function normalizeSelection(
	plugin: TextEaterPlugin,
	editor: Editor,
	file: TFile,
	selection: string
) {
	const notice = new Notice('Normalizing selection...', 0);
	try {
		const response = await plugin.apiService.normalize(selection);
		if (response) {
			editor.replaceSelection(response);
		}
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	} finally {
		notice.hide();
	}
}
