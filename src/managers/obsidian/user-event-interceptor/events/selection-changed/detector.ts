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
import { PayloadKind } from "../../types/payload-base";
import type { HandlerInvoker } from "../../user-event-interceptor";
import { getCurrentFilePath } from "../get-current-file-path";
import { SelectionChangedCodec } from "./codec";
import type { SelectionChangedPayload } from "./payload";

export class SelectionChangedDetector {
	private mouseupHandler: ((evt: MouseEvent) => void) | null = null;
	private keyupHandler: ((evt: KeyboardEvent) => void) | null = null;
	private dragendHandler: (() => void) | null = null;
	private readonly invoker: HandlerInvoker<SelectionChangedPayload>;

	constructor(
		private readonly app: App,
		createInvoker: (
			kind: PayloadKind,
		) => HandlerInvoker<SelectionChangedPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.SelectionChanged);
	}

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
		const splitPath = getCurrentFilePath(this.app);

		// Encode to payload
		const payload = SelectionChangedCodec.encode({
			hasSelection,
			selectedText,
			source,
			splitPath,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - nothing to do
			return;
		}

		// Invoke handler
		void invoke();
	}
}
