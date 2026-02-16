import { type App, MarkdownView } from "obsidian";
import type { SplitPathToMdFile } from "../../vault-action-manager/types/split-path";

export function getCurrentFilePath(app: App): SplitPathToMdFile | undefined {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view?.file) return undefined;

	const path = view.file.path;
	const parts = path.split("/");
	const filename = parts.pop() ?? "";
	const basename = filename.replace(/\.md$/, "");

	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts: parts,
	};
}
