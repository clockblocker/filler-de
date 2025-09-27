import { App, Editor } from 'obsidian';
import { Maybe } from 'types/general';
import { getMaybeEditor } from './helpers/get-maybe-editor';

export class SelectionService {
	constructor(private app: App) {}

	private async getEditor(): Promise<Editor> {
		const maybeEditor = await getMaybeEditor(this.app);
		if (maybeEditor.error) {
			throw new Error(maybeEditor.description ?? 'No active editor');
		}
		return maybeEditor.data;
	}

	public async getMaybeSelection(): Promise<Maybe<string>> {
		try {
			const editor = await this.getEditor();
			const selection = editor.getSelection();

			if (!selection) {
				return { error: true, description: 'Selection is empty' };
			}

			return { error: false, data: selection };
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
			const editor = await this.getEditor();

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
}
