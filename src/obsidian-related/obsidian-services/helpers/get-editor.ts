import { App, Editor, MarkdownView } from 'obsidian';
import { unwrapMaybe, type Maybe } from '../../../types/general';

export async function getMaybeEditor(app: App): Promise<Maybe<Editor>> {
	try {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.file) {
			return { error: false, data: view.editor };
		}
		return { error: true, description: `Failed to get Editor` };
	} catch (error) {
		return { error: true, description: `Failed to get Editor: ${error}` };
	}
}

export async function getEditor(app: App): Promise<Editor> {
	const mbEditor = await getMaybeEditor(app);
	if (mbEditor.error) {
		throw new Error(mbEditor.description ?? 'No active editor');
	}

	const editor = unwrapMaybe(mbEditor);
	return editor;
}
