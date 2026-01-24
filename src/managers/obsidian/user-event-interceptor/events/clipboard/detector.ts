/**
 * ClipboardDetector - detects copy/cut events with behavior chain integration.
 *
 * Flow:
 * 1. Capture clipboard event
 * 2. Encode to ClipboardPayload via codec
 * 3. Check if any behavior is applicable (sync)
 * 4. If applicable: preventDefault, run behavior chain, execute default action
 * 5. If not applicable: let native behavior proceed
 */

import { type App, MarkdownView } from "obsidian";
import type { VaultActionManager } from "../../../vault-action-manager";
import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import {
	anyApplicable,
	executeChain,
	getBehaviorRegistry,
} from "../../behavior-chain";
import type { BehaviorContext } from "../../types/behavior";
import { PayloadKind } from "../../types/payload-base";
import { ClipboardCodec } from "./codec";
import { executeClipboardDefaultAction } from "./default-action";
import type { ClipboardPayload } from "./payload";

/** Pattern to match block reference at end of text */
const BLOCK_REF_PATTERN = /\s\^([a-zA-Z0-9-]+)\s*$/;

export class ClipboardDetector {
	private handler: ((evt: ClipboardEvent) => void) | null = null;

	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(): void {
		if (this.handler) return;

		this.handler = (evt) => this.handleClipboard(evt);

		document.addEventListener("copy", this.handler);
		document.addEventListener("cut", this.handler);
	}

	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("copy", this.handler);
			document.removeEventListener("cut", this.handler);
			this.handler = null;
		}
	}

	// ─── Private ───

	private handleClipboard(evt: ClipboardEvent): void {
		const selection = window.getSelection()?.toString();

		// No selection: handle block reference copy (copy only, not cut)
		if (!selection) {
			if (evt.type === "copy") {
				this.handleBlockReferenceCopy(evt);
			}
			return;
		}

		// Get current file path (may be null if no file open)
		const splitPath = this.getCurrentFilePath();

		// Encode to payload
		const payload = ClipboardCodec.encode(evt, selection, splitPath);

		// Get behaviors for clipboard events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<ClipboardPayload>(
			PayloadKind.ClipboardCopy,
		);

		// Check if any behavior is applicable (sync check)
		if (!anyApplicable(payload, behaviors)) {
			// No behaviors apply - let native behavior proceed
			return;
		}

		// Behaviors apply - preventDefault and run chain
		evt.preventDefault();

		// Build context
		const baseCtx: Omit<BehaviorContext<ClipboardPayload>, "data"> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		// Execute chain and default action
		void executeChain(payload, behaviors, baseCtx).then((result) =>
			executeClipboardDefaultAction(result, evt),
		);
	}

	/**
	 * Handle copy when no selection exists.
	 * If clipboard text ends with block ref ^{id}, replace with wikilink.
	 */
	private handleBlockReferenceCopy(evt: ClipboardEvent): void {
		const clipboardText = evt.clipboardData?.getData("text/plain");
		if (!clipboardText) return;

		const match = clipboardText.match(BLOCK_REF_PATTERN);
		if (!match) return;

		const blockId = match[1];
		const basename = this.getActiveFileBasename();
		if (!basename) return;

		const wikilink = `![[${basename}#^${blockId}|^]]`;

		evt.preventDefault();
		evt.clipboardData?.setData("text/plain", wikilink);
	}

	private getActiveFileBasename(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file?.basename ?? null;
	}

	private getCurrentFilePath(): SplitPathToMdFile | undefined {
		// Synchronously get current file path if available
		// This is a simplified version - behaviors can use vaultActionManager.pwd() for async
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
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
}
