import type { App } from "obsidian";
import { getEditor } from "../../../managers/obsidian/vault-action-manager/helpers/get-editor";
import type { MaybeLegacy } from "../../../types/common-interface/maybe";

export class SelectionService {
	constructor(private app: App) {}

	public async getMaybeLegacySelection(): Promise<MaybeLegacy<string>> {
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
		const maybeSel = await this.getMaybeLegacySelection();
		if (maybeSel.error) {
			throw new Error(maybeSel.description ?? "No selection");
		}
		return maybeSel.data;
	}

	public async appendBelow(text: string): Promise<MaybeLegacy<void>> {
		try {
			const editor = await getEditor(this.app);

			const sel = editor.listSelections?.()[0];
			const cursor = sel?.head ?? editor.getCursor();
			const insertLine = Math.max(cursor.line + 1, 0);

			editor.replaceRange(`\n${text}\n`, {
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
