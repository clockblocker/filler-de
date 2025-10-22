import type { App } from "obsidian";
import type { Maybe } from "../../../types/common-interface/maybe";
import { getEditor } from "../helpers/get-editor";

export class SelectionService {
	constructor(private app: App) {}

	public async getMaybeSelection(): Promise<Maybe<string>> {
		try {
			const editor = await getEditor(this.app);
			return { data: editor.getSelection(), error: false };
		} catch (e) {
			return {
				description: e instanceof Error ? e.message : String(e),
				error: true,
			};
		}
	}

	public async getSelection(): Promise<string> {
		const maybeSel = await this.getMaybeSelection();
		if (maybeSel.error) {
			throw new Error(maybeSel.description ?? "No selection");
		}
		return maybeSel.data;
	}

	public async appendBelow(text: string): Promise<Maybe<void>> {
		try {
			const editor = await getEditor(this.app);

			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);

			editor.replaceRange("\n" + text + "\n", {
				ch: 0,
				line: insertLine,
			});
			return { data: undefined, error: false };
		} catch (e) {
			return {
				description: e instanceof Error ? e.message : String(e),
				error: true,
			};
		}
	}

	public async replaceSelection(text: string): Promise<void> {
		const editor = await getEditor(this.app);
		editor.replaceSelection(text);
	}
}
