/**
 * SelectAllDetector - detects Ctrl/Cmd+A with behavior chain integration.
 *
 * Emits SelectAllPayload when user presses select-all shortcut in source mode.
 */

import type { EditorView } from "@codemirror/view";
import { type App, MarkdownView, Platform } from "obsidian";
import { DomSelectors } from "../../../../../utils/dom-selectors";
import type { VaultActionManager } from "../../../vault-action-manager";
import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import {
	anyApplicable,
	executeChain,
	getBehaviorRegistry,
} from "../../behavior-chain";
import type { BehaviorContext } from "../../types/behavior";
import { PayloadKind } from "../../types/payload-base";
import { SelectAllCodec } from "./codec";
import { executeSelectAllDefaultAction } from "./default-action";
import type { SelectAllPayload } from "./payload";

export class SelectAllDetector {
	private handler: ((evt: KeyboardEvent) => void) | null = null;

	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(): void {
		if (this.handler) return;

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

		// Don't interfere when user is editing the file basename (inline title)
		const activeEl = document.activeElement;
		if (activeEl?.classList.contains(DomSelectors.INLINE_TITLE_CLASS))
			return;

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

		// Get current file path
		const splitPath = this.getCurrentFilePath();

		// Encode to payload
		const payload = SelectAllCodec.encode({
			content,
			splitPath,
			view: cm,
		});

		// Get behaviors for select-all events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<SelectAllPayload>(
			PayloadKind.SelectAll,
		);

		// If no behaviors, let native behavior proceed
		if (behaviors.length === 0) return;

		// Check if any behavior is applicable
		if (!anyApplicable(payload, behaviors)) return;

		// Behaviors apply - preventDefault and run chain
		evt.preventDefault();
		evt.stopPropagation();

		// Build context
		const baseCtx: Omit<BehaviorContext<SelectAllPayload>, "data"> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		// Execute chain and default action
		void executeChain(payload, behaviors, baseCtx).then((result) =>
			executeSelectAllDefaultAction(result),
		);
	}

	private getCurrentFilePath(): SplitPathToMdFile | undefined {
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
