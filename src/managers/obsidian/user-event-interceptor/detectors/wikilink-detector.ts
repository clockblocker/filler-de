/**
 * WikilinkDetector - detects wikilink completions.
 *
 * Emits WikilinkCompletedEvent when user completes a wikilink (cursor right after ]]).
 * Uses registerEditorExtension which persists until plugin unload.
 * Guards emit with `listening` flag since extension persists beyond stopListening().
 *
 * Skips:
 * - Links that already have an alias (contain |)
 * - Nested wikilinks
 * - Empty link content
 */

import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { Plugin } from "obsidian";
import {
	InterceptableUserEventKind,
	type WikilinkCompletedEvent,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class WikilinkDetector implements Detector {
	private extension: ReturnType<typeof EditorView.updateListener.of> | null =
		null;
	private emit: DetectorEmitter | null = null;
	private listening = false;

	constructor(private plugin: Plugin) {}

	startListening(emit: DetectorEmitter): void {
		this.emit = emit;
		this.listening = true;

		// Only register extension once (persists until plugin unload)
		if (this.extension) return;

		this.extension = EditorView.updateListener.of((vu: ViewUpdate) => {
			this.handleUpdate(vu);
		});

		this.plugin.registerEditorExtension(this.extension);
	}

	stopListening(): void {
		// Can't unregister extension, but stop emitting
		this.listening = false;
		this.emit = null;
	}

	// ─── Private ───

	private handleUpdate(vu: ViewUpdate): void {
		// Guard: only emit when listening
		if (!this.listening || !this.emit) return;

		if (!vu.docChanged) return;

		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();
		const charsBeforeCursor = text.slice(cursor - 2, cursor);

		// Check if we just completed a wikilink (cursor right after ]])
		if (charsBeforeCursor !== "]]") return;

		// Find matching [[
		const closePos = cursor - 2;
		const openPos = text.lastIndexOf("[[", closePos);

		if (openPos === -1) return;

		// Ensure no nested [[ between open and close
		const between = text.slice(openPos + 2, closePos);

		if (between.includes("[[")) return;

		// Skip if already has an alias
		if (between.includes("|")) return;

		const linkContent = between.trim();
		if (!linkContent) return;

		const view = vu.view;
		const event: WikilinkCompletedEvent = {
			closePos,
			insertAlias: (alias: string) => {
				view.dispatch({
					changes: { from: closePos, insert: `|${alias}` },
				});
			},
			kind: InterceptableUserEventKind.WikilinkCompleted,
			linkContent,
		};

		this.emit(event);
	}
}
