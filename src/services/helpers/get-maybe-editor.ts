import { App, Editor, MarkdownView } from 'obsidian';
import { Maybe } from 'types/general';

export async function getMaybeEditor(app: App): Promise<Maybe<Editor>> {
	try {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.file) {
			return { error: false, data: view.editor };
		}
		return { error: true, errorText: `Failed to get Editor` };
	} catch (error) {
		return { error: true, errorText: `Failed to get Editor: ${error}` };
	}
}
