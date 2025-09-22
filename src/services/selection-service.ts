import { App, Editor, MarkdownView } from 'obsidian';
import { Maybe } from 'types/general';

export class SelectionService {
	constructor(private app: App) {}

	private getEditor(): Editor | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return null;
		return view.editor;
	}

	public getSelection(): Maybe<string> {
		try {
			const editor = this.getEditor();
			if (!editor) return { error: true, errorText: 'No active editor' };
			const sel = editor.getSelection();
			if (!sel) return { error: true, errorText: 'No selection' };
			return { error: false, data: sel };
		} catch (e) {
			return {
				error: true,
				errorText: e instanceof Error ? e.message : String(e),
			};
		}
	}

	public appendBelow(text: string): Maybe<void> {
		try {
			const editor = this.getEditor();
			if (!editor) return { error: true, errorText: 'No active editor' };

			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);

			editor.replaceRange('\n\n' + text + '\n', { line: insertLine, ch: 0 });
			return { error: false, data: undefined };
		} catch (e) {
			return {
				error: true,
				errorText: e instanceof Error ? e.message : String(e),
			};
		}
	}
}
