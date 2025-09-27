import { App, Editor, MarkdownView } from 'obsidian';
import { Maybe } from 'types/general';

export class SelectionService {
	constructor(private app: App) {}

	private getMaybeEditor(): Maybe<Editor> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			return { error: true, errorText: 'No active editor' };
		}

		return { error: false, data: view.editor };
	}

	private getEditor(): Editor {
		const maybeEditor = this.getMaybeEditor();
		if (maybeEditor.error) {
			throw new Error(maybeEditor.errorText ?? 'No active editor');
		}
		return maybeEditor.data;
	}

	public getMaybeSelection(): Maybe<string> {
		try {
			const editor = this.getEditor();
			const selection = editor.getSelection();

			if (!selection) {
				return { error: true, errorText: 'Selection is empty' };
			}

			return { error: false, data: selection };
		} catch (e) {
			return {
				error: true,
				errorText: e instanceof Error ? e.message : String(e),
			};
		}
	}

	public getSelection(): string {
		const maybeSel = this.getMaybeSelection();
		if (maybeSel.error) {
			throw new Error(maybeSel.errorText ?? 'No selection');
		}
		return maybeSel.data;
	}

	public appendBelow(text: string): Maybe<void> {
		try {
			const editor = this.getEditor();

			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);

			editor.replaceRange('\n' + text + '\n', { line: insertLine, ch: 0 });
			return { error: false, data: undefined };
		} catch (e) {
			return {
				error: true,
				errorText: e instanceof Error ? e.message : String(e),
			};
		}
	}
}
