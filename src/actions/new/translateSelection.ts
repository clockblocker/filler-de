import { Notice } from 'obsidian';
import TextEaterPlugin from '../../main';

export default async function newTranslateSelection(plugin: TextEaterPlugin) {
	try {
		const maybeSel = plugin.selectionService.getSelection();
		if (maybeSel.error) {
			new Notice(maybeSel.errorText ?? 'No selection');
			return;
		}

		const sel = maybeSel.data;

		const response = await plugin.apiService.translateText(sel);

		if (!response) return;

		plugin.selectionService.appendBelow(response);
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
