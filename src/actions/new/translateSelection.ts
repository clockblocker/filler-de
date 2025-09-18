import { Notice } from 'obsidian';
import TextEaterPlugin from '../../main';
import { SelectionService } from 'services/selection-service';

export default async function newTranslateSelection(plugin: TextEaterPlugin) {
	try {
		const selectionService = new SelectionService(plugin.app);
		const maybeSel = selectionService.getSelection();
		if (maybeSel.error) {
			new Notice(maybeSel.errorText ?? 'No selection');
			return;
		}
		const sel = maybeSel.data;
		const response = await plugin.apiService.translateText(sel);
		if (!response) return;
		selectionService.appendBelow(sel + '\n\n' + response + '\n');
	} catch (error) {
		new Notice(`Error: ${error.message}`);
	}
}
