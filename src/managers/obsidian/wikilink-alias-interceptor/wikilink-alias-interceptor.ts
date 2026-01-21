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
import { logger } from "../../../utils/logger";

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
			logger.info("[WikilinkAlias] already registered");
			return;
		}

		logger.info("[WikilinkAlias] registering editor extension");

		this.extension = EditorView.updateListener.of((vu: ViewUpdate) => {
			this.handleUpdate(vu);
		});

		this.plugin.registerEditorExtension(this.extension);
		logger.info("[WikilinkAlias] editor extension registered");
	}

	// ─── Private ───

	private handleUpdate(vu: ViewUpdate): void {
		if (!vu.docChanged) {
			return;
		}

		const cursor = vu.state.selection.main.head;
		const text = vu.state.doc.toString();
		const charsBeforeCursor = text.slice(cursor - 2, cursor);

		logger.info(
			"[WikilinkAlias] handleUpdate docChanged, cursor:",
			String(cursor),
			"charsBeforeCursor:",
			JSON.stringify(charsBeforeCursor),
		);

		// Check if we just completed a wikilink (cursor right after ]])
		if (charsBeforeCursor !== "]]") {
			return;
		}

		// Find matching [[
		const closePos = cursor - 2;
		const openPos = text.lastIndexOf("[[", closePos);
		logger.info(
			"[WikilinkAlias] found ]], closePos:",
			String(closePos),
			"openPos:",
			String(openPos),
		);

		if (openPos === -1) {
			logger.info("[WikilinkAlias] no [[ found, skipping");
			return;
		}

		// Ensure no nested [[ between open and close
		const between = text.slice(openPos + 2, closePos);
		logger.info("[WikilinkAlias] content between [[...]]:", JSON.stringify(between));

		if (between.includes("[[")) {
			logger.info("[WikilinkAlias] nested [[ found, skipping");
			return;
		}

		// Skip if already has an alias
		if (between.includes("|")) {
			logger.info("[WikilinkAlias] already has alias, skipping");
			return;
		}

		const linkContent = between.trim();
		if (!linkContent) {
			logger.info("[WikilinkAlias] empty link content, skipping");
			return;
		}

		logger.info(
			"[WikilinkAlias] emitting WikilinkCompleted, subscribers:",
			String(this.subscribers.size),
			"linkContent:",
			JSON.stringify(linkContent),
		);

		// Emit to all subscribers
		for (const handler of this.subscribers) {
			handler({ kind: "WikilinkCompleted", linkContent, closePos, view: vu.view });
		}
	}
}
