/**
 * SelectAllDetector - detects Ctrl/Cmd+A and provides callbacks for custom selection.
 *
 * Emits SelectAllEvent with:
 * - Full document content
 * - CodeMirror view for selection dispatch
 * - Callbacks to prevent default and set selection range
 *
 * Business logic (smart range calculation) is handled by subscribers.
 */

import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type App, MarkdownView, Platform } from "obsidian";
import {
	InterceptableUserEventKind,
	type SelectAllEvent,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class SelectAllDetector implements Detector {
	private handler: ((evt: KeyboardEvent) => void) | null = null;
	private emit: DetectorEmitter | null = null;

	constructor(private app: App) {}

	startListening(emit: DetectorEmitter): void {
		if (this.handler) return;

		this.emit = emit;
		this.handler = (evt) => this.handleKeydown(evt);

		// Use capture phase to intercept before the editor
		document.addEventListener("keydown", this.handler, { capture: true });
	}

	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("keydown", this.handler, {
				capture: true,
			});
			this.handler = null;
			this.emit = null;
		}
	}

	// ─── Private ───

	private handleKeydown(evt: KeyboardEvent): void {
		if (!this.emit) return;

		// Check for Ctrl+A (Windows/Linux) or Cmd+A (Mac)
		const isSelectAll =
			evt.key === "a" &&
			(Platform.isMacOS ? evt.metaKey : evt.ctrlKey) &&
			!evt.shiftKey &&
			!evt.altKey;

		if (!isSelectAll) return;

		// Don't interfere when user is editing the file basename (inline title)
		const activeEl = document.activeElement;
		if (activeEl?.classList.contains("inline-title")) return;

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

		const event: SelectAllEvent = {
			content,
			kind: InterceptableUserEventKind.SelectAll,
			preventDefault: () => {
				evt.preventDefault();
				evt.stopPropagation();
			},
			setSelection: (from: number, to: number) => {
				cm.dispatch({
					selection: EditorSelection.single(from, to),
				});
			},
			view: cm,
		};

		this.emit(event);
	}
}
