/**
 * WikilinkDetector - detects wikilink completions with behavior chain integration.
 *
 * Emits WikilinkPayload when user completes a wikilink (cursor right after ]]).
 * Uses registerEditorExtension which persists until plugin unload.
 *
 * Skips:
 * - Links that already have an alias (contain |)
 * - Nested wikilinks
 * - Empty link content
 */

import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { App, Plugin } from "obsidian";
import type { VaultActionManager } from "../../../vault-action-manager";
import {
	anyApplicable,
	executeChain,
	getBehaviorRegistry,
} from "../../behavior-chain";
import type { BehaviorContext } from "../../types/behavior";
import { PayloadKind } from "../../types/payload-base";
import { WikilinkCodec } from "./codec";
import { executeWikilinkDefaultAction } from "./default-action";
import type { WikilinkPayload } from "./payload";

export class WikilinkDetector {
	private extension: ReturnType<typeof EditorView.updateListener.of> | null =
		null;
	private listening = false;

	constructor(
		private readonly plugin: Plugin,
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(): void {
		this.listening = true;

		// Only register extension once (persists until plugin unload)
		if (this.extension) return;

		this.extension = EditorView.updateListener.of((vu: ViewUpdate) => {
			this.handleUpdate(vu);
		});

		this.plugin.registerEditorExtension(this.extension);
	}

	stopListening(): void {
		// Can't unregister extension, but stop processing
		this.listening = false;
	}

	// ─── Private ───

	private handleUpdate(vu: ViewUpdate): void {
		// Guard: only process when listening
		if (!this.listening) return;

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

		// Encode to payload
		const payload = WikilinkCodec.encode({
			closePos,
			linkContent,
			view: vu.view,
		});

		// Get behaviors for wikilink events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<WikilinkPayload>(
			PayloadKind.WikilinkCompleted,
		);

		// If no behaviors, nothing to do
		if (behaviors.length === 0) return;

		// Check if any behavior is applicable
		if (!anyApplicable(payload, behaviors)) return;

		// Build context
		const baseCtx: Omit<BehaviorContext<WikilinkPayload>, "data"> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		// Execute chain and default action
		void executeChain(payload, behaviors, baseCtx).then((result) =>
			executeWikilinkDefaultAction(result),
		);
	}
}
