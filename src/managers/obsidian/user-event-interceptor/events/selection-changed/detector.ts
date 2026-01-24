/**
 * SelectionChangedDetector - detects text selection changes.
 *
 * Handles:
 * - Mouse selection (mouseup)
 * - Keyboard selection (keyup with selection keys)
 * - Drag selection (dragend)
 *
 * Emits SelectionChangedPayload to trigger toolbar recompute.
 */

import { type App, MarkdownView } from "obsidian";
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
import { SelectionChangedCodec } from "./codec";
import type { SelectionChangedPayload } from "./payload";

export class SelectionChangedDetector {
	private mouseupHandler: ((evt: MouseEvent) => void) | null = null;
	private keyupHandler: ((evt: KeyboardEvent) => void) | null = null;
	private dragendHandler: (() => void) | null = null;

	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(): void {
		if (this.mouseupHandler) return;

		this.mouseupHandler = (evt) => this.handleMouseUp(evt);
		this.keyupHandler = (evt) => this.handleKeyUp(evt);
		this.dragendHandler = () => this.handleDragEnd();

		document.addEventListener("mouseup", this.mouseupHandler);
		document.addEventListener("keyup", this.keyupHandler);
		document.addEventListener("dragend", this.dragendHandler);
	}

	stopListening(): void {
		if (this.mouseupHandler) {
			document.removeEventListener("mouseup", this.mouseupHandler);
			this.mouseupHandler = null;
		}
		if (this.keyupHandler) {
			document.removeEventListener("keyup", this.keyupHandler);
			this.keyupHandler = null;
		}
		if (this.dragendHandler) {
			document.removeEventListener("dragend", this.dragendHandler);
			this.dragendHandler = null;
		}
	}

	// ─── Private ───

	private handleMouseUp(evt: MouseEvent): void {
		// Skip if clicking on action buttons (handled by ActionElementDetector)
		const target = evt.target as HTMLElement;
		if (target.closest(DomSelectors.DATA_ACTION)) return;

		this.emitSelectionEvent("mouse");
	}

	private handleKeyUp(evt: KeyboardEvent): void {
		// Only emit for selection-related keys
		const selectionKeys = [
			"ArrowLeft",
			"ArrowRight",
			"ArrowUp",
			"ArrowDown",
			"Shift",
			"Home",
			"End",
			"PageUp",
			"PageDown",
			"a", // For Ctrl/Cmd+A (though SelectAllDetector handles the special case)
		];

		if (!evt.shiftKey && !selectionKeys.includes(evt.key)) return;

		this.emitSelectionEvent("keyboard");
	}

	private handleDragEnd(): void {
		this.emitSelectionEvent("drag");
	}

	private emitSelectionEvent(
		source: SelectionChangedPayload["source"],
	): void {
		// Get current selection from editor
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const selectedText = view?.editor?.getSelection() ?? "";
		const hasSelection = selectedText.length > 0;

		// Get current file path
		const splitPath = this.getCurrentFilePath();

		// Encode to payload
		const payload = SelectionChangedCodec.encode({
			hasSelection,
			selectedText,
			source,
			splitPath,
		});

		// Get behaviors for selection changed events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<SelectionChangedPayload>(
			PayloadKind.SelectionChanged,
		);

		// If no behaviors, nothing to do
		if (behaviors.length === 0) return;

		// Check if any behavior is applicable
		if (!anyApplicable(payload, behaviors)) return;

		// Build context and execute chain
		const baseCtx: Omit<
			BehaviorContext<SelectionChangedPayload>,
			"data"
		> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		// Execute chain (no default action for selection changed)
		void executeChain(payload, behaviors, baseCtx);
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
