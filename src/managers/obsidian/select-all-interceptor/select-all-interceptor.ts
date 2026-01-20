/**
 * SelectAllInterceptor - intercepts Ctrl/Cmd+A to exclude
 * go-back links, frontmatter, and metadata from selection.
 *
 * Only active in source mode (CodeMirror editor).
 */

import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type App, MarkdownView, Platform } from "obsidian";
import { calculateSmartRange } from "./range-calculator";

export class SelectAllInterceptor {
	private handler: ((evt: KeyboardEvent) => void) | null = null;

	constructor(private app: App) {}

	/**
	 * Start listening to keydown events.
	 */
	startListening(): void {
		if (this.handler) return;

		this.handler = (evt) => this.handleKeydown(evt);
		// Use capture phase to intercept before the editor
		document.addEventListener("keydown", this.handler, { capture: true });
	}

	/**
	 * Stop listening to keydown events.
	 */
	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("keydown", this.handler, {
				capture: true,
			});
			this.handler = null;
		}
	}

	// ─── Private ───

	private handleKeydown(evt: KeyboardEvent): void {
		// Check for Ctrl+A (Windows/Linux) or Cmd+A (Mac)
		const isSelectAll =
			evt.key === "a" &&
			(Platform.isMacOS ? evt.metaKey : evt.ctrlKey) &&
			!evt.shiftKey &&
			!evt.altKey;

		if (!isSelectAll) return;

		// Get active markdown view
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		// Only work in source mode
		if (view.getMode() !== "source") return;

		// Get the CodeMirror 6 editor
		// biome-ignore lint/suspicious/noExplicitAny: cm exists but is not typed in Obsidian's API
		const cm: EditorView | undefined = (view.editor as any).cm;
		if (!cm) return;

		// Get document content
		const content = cm.state.doc.toString();
		if (!content) return;

		// Calculate smart range
		const { from, to } = calculateSmartRange(content);

		// If the range covers everything or nothing, let default behavior handle it
		if ((from === 0 && to === content.length) || from >= to) {
			return;
		}

		// Prevent default select-all
		evt.preventDefault();
		evt.stopPropagation();

		// Dispatch selection change to CodeMirror
		cm.dispatch({
			selection: EditorSelection.single(from, to),
		});
	}
}
