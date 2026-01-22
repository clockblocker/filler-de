/**
 * ActionClickDetector - detects clicks on [data-action] buttons.
 *
 * Handles:
 * - Toolbar buttons (bottom, selection)
 * - Edge zone divs
 * - Overflow menu items
 *
 * Uses mousedown in capture phase to catch clicks before re-renders.
 */

import { DomSelectors } from "../../../../utils/dom-selectors";
import {
	type ActionClickedEvent,
	InterceptableUserEventKind,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class ActionClickDetector implements Detector {
	private handler: ((evt: MouseEvent) => void) | null = null;
	private emit: DetectorEmitter | null = null;

	startListening(emit: DetectorEmitter): void {
		if (this.handler) return;

		this.emit = emit;
		this.handler = (evt) => this.handleMouseDown(evt);

		// Use capture phase to intercept before re-renders
		document.addEventListener("mousedown", this.handler, { capture: true });
	}

	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("mousedown", this.handler, {
				capture: true,
			});
			this.handler = null;
			this.emit = null;
		}
	}

	// ─── Private ───

	private handleMouseDown(evt: MouseEvent): void {
		if (!this.emit) return;

		// Only handle left mouse button
		if (evt.button !== 0) return;

		const target = evt.target as HTMLElement;
		const button = target.closest(
			DomSelectors.DATA_ACTION,
		) as HTMLElement | null;
		if (!button) return;

		// Skip disabled buttons
		if (button.hasAttribute("disabled")) return;

		const actionId = button.dataset[DomSelectors.DATA_ACTION_ATTR];
		if (!actionId) return;

		const event: ActionClickedEvent = {
			actionId,
			button,
			kind: InterceptableUserEventKind.ActionClicked,
		};

		this.emit(event);
	}
}
