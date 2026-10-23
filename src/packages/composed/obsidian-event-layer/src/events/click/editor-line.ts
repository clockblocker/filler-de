import { type App, MarkdownView } from "obsidian";
import { DomSelectors } from "../../internal/dom-selectors";

/**
 * The active editor's text of the rendered line `lineElement`, found by
 * its index among the editor's rendered lines; null outside an editor.
 */
export function editorLineOf(app: App, lineElement: Element): string | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view?.editor) return null;

	const cmContent = lineElement.closest(DomSelectors.CM_CONTENT);
	if (!cmContent) return null;

	const lines = Array.from(cmContent.querySelectorAll(DomSelectors.CM_LINE));
	const lineIndex = lines.indexOf(lineElement);
	if (lineIndex === -1) return null;

	return view.editor.getLine(lineIndex) ?? null;
}
