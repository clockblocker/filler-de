import { err, ok, type Result } from "neverthrow";
import { type App, type Editor, MarkdownView } from "obsidian";
import { errorGetEditor } from "../errors";

export function getEditor(app: App): Result<Editor, string> {
	try {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ? ok(view.editor) : err(errorGetEditor());
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return err(errorGetEditor(message));
	}
}
