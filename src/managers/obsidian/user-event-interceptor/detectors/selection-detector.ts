/**
 * SelectionDetector - detects text selection changes.
 *
 * Handles:
 * - Mouse selection (mouseup)
 * - Keyboard selection (keyup with selection keys)
 * - Drag selection (dragend)
 *
 * Emits SelectionChangedEvent to trigger toolbar recompute.
 */

import { type App, MarkdownView } from "obsidian";
import { DomSelectors } from "../../../../utils/dom-selectors";
import {
	InterceptableUserEventKind,
	type SelectionChangedEvent,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class SelectionDetector implements Detector {
	private mouseupHandler: ((evt: MouseEvent) => void) | null = null;
	private keyupHandler: ((evt: KeyboardEvent) => void) | null = null;
	private dragendHandler: (() => void) | null = null;
	private emit: DetectorEmitter | null = null;

	constructor(private readonly app: App) {}

	startListening(emit: DetectorEmitter): void {
		if (this.mouseupHandler) return;

		this.emit = emit;

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
		this.emit = null;
	}

	// ─── Private ───

	private handleMouseUp(evt: MouseEvent): void {
		if (!this.emit) return;

		// Skip if clicking on action buttons (handled by ActionClickDetector)
		const target = evt.target as HTMLElement;
		if (target.closest(DomSelectors.DATA_ACTION)) return;

		this.emitSelectionEvent("mouse");
	}

	private handleKeyUp(evt: KeyboardEvent): void {
		if (!this.emit) return;

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
		if (!this.emit) return;
		this.emitSelectionEvent("drag");
	}

	private emitSelectionEvent(source: SelectionChangedEvent["source"]): void {
		if (!this.emit) return;

		// Get current selection from editor
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const selectedText = view?.editor?.getSelection() ?? "";
		const hasSelection = selectedText.length > 0;

		const event: SelectionChangedEvent = {
			hasSelection,
			kind: InterceptableUserEventKind.SelectionChanged,
			selectedText,
			source,
		};

		this.emit(event);
	}
}
