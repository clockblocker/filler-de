/**
 * WikilinkAliasInterceptor - emits events when wikilinks are completed.
 *
 * Detects when user completes a wikilink (cursor right after ]]) and emits
 * WikilinkCompletedEvent to subscribers. Business logic (validation, alias insertion)
 * is handled by subscribers (e.g., Librarian).
 *
 * Skips:
 * - Links that already have an alias (contain |)
 * - Nested wikilinks
 * - Empty link content
 */

import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { Plugin } from "obsidian";

// ─── Event Types ───

export type WikilinkCompletedEvent = {
	kind: "WikilinkCompleted";
	linkContent: string; // raw content between [[ and ]]
	closePos: number; // position before ]]
	view: EditorView; // for dispatching changes
};

export type WikilinkEventHandler = (event: WikilinkCompletedEvent) => void;
export type Teardown = () => void;

// ─── Interceptor ───

export class WikilinkAliasInterceptor {
	private extension: ReturnType<typeof EditorView.updateListener.of> | null =
		null;
	private subscribers = new Set<WikilinkEventHandler>();

	constructor(private plugin: Plugin) {}

	/**
	 * Subscribe to wikilink completion events.
	 * Returns teardown function to unsubscribe.
	 */
	subscribe(handler: WikilinkEventHandler): Teardown {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Register the editor extension to intercept wikilink completions.
	 */
	register(): void {
		if (this.extension) {
			return;
		}

		this.extension = EditorView.updateListener.of((vu: ViewUpdate) => {
			this.handleUpdate(vu);
		});

		this.plugin.registerEditorExtension(this.extension);
	}

	// ─── Private ───

	private handleUpdate(vu: ViewUpdate): void {
		if (!vu.docChanged) {
			return;
		}

		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();
		const charsBeforeCursor = text.slice(cursor - 2, cursor);

		// Check if we just completed a wikilink (cursor right after ]])
		if (charsBeforeCursor !== "]]") {
			return;
		}

		// Find matching [[
		const closePos = cursor - 2;
		const openPos = text.lastIndexOf("[[", closePos);

		if (openPos === -1) {
			return;
		}

		// Ensure no nested [[ between open and close
		const between = text.slice(openPos + 2, closePos);

		if (between.includes("[[")) {
			return;
		}

		// Skip if already has an alias
		if (between.includes("|")) {
			return;
		}

		const linkContent = between.trim();
		if (!linkContent) {
			return;
		}

		// Emit to all subscribers
		for (const handler of this.subscribers) {
			handler({
				closePos,
				kind: "WikilinkCompleted",
				linkContent,
				view: vu.view,
			});
		}
	}
}
