import type { App } from 'obsidian';
import { getEditor } from '../helpers/get-editor';
import type { Maybe } from '../../types/general';

export class SelectionService {
	constructor(private app: App) {}

	public async getMaybeSelection(): Promise<Maybe<string>> {
		try {
			const editor = await getEditor(this.app);
			return { error: false, data: editor.getSelection() };
		} catch (e) {
			return {
				error: true,
				description: e instanceof Error ? e.message : String(e),
			};
		}
	}

	public async getSelection(): Promise<string> {
		const maybeSel = await this.getMaybeSelection();
		if (maybeSel.error) {
			throw new Error(maybeSel.description ?? 'No selection');
		}
		return maybeSel.data;
	}

	public async appendBelow(text: string): Promise<Maybe<void>> {
		try {
			const editor = await getEditor(this.app);

			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);

			editor.replaceRange('\n' + text + '\n', { line: insertLine, ch: 0 });
			return { error: false, data: undefined };
		} catch (e) {
			return {
				error: true,
				description: e instanceof Error ? e.message : String(e),
			};
		}
	}

	public async replaceSelection(text: string): Promise<void> {
		const editor = await getEditor(this.app);
		editor.replaceSelection(text);
	}
}
