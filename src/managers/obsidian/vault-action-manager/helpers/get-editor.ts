import { type App, type Editor, MarkdownView } from "obsidian";
import {
	type MaybeLegacy,
	unwrapMaybeLegacyByThrowing,
} from "../../../../types/common-interface/maybe";

export async function getMaybeLegacyEditor(
	app: App,
): Promise<MaybeLegacy<Editor>> {
	try {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.file) {
			return { data: view.editor, error: false };
		}
		return { description: "Failed to get Editor", error: true };
	} catch (error) {
		return { description: `Failed to get Editor: ${error}`, error: true };
	}
}

export async function getEditor(app: App): Promise<Editor> {
	const mbEditor = await getMaybeLegacyEditor(app);
	if (mbEditor.error) {
		throw new Error(mbEditor.description ?? "No active editor");
	}

	const editor = unwrapMaybeLegacyByThrowing(mbEditor);
	return editor;
}
