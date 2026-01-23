/**
 * ActionClickDetector - detects clicks on [data-action] buttons.
 *
 * Handles:
 * - Toolbar buttons (bottom, selection)
 * - Edge zone divs
 * - Overflow menu items
 *
 * Subscribes to GenericClickDetector and filters for [data-action] targets.
 */

import { DomSelectors } from "../../../../utils/dom-selectors";
import {
	type ActionClickedEvent,
	InterceptableUserEventKind,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";
import type { GenericClickDetector } from "./generic";

export class ActionClickDetector implements Detector {
	private unsubscribe: (() => void) | null = null;
	private emit: DetectorEmitter | null = null;

	constructor(private readonly genericClick: GenericClickDetector) {}

	startListening(emit: DetectorEmitter): void {
		if (this.unsubscribe) return;

		this.emit = emit;
		this.unsubscribe = this.genericClick.subscribe((target, _evt) => {
			this.handleClick(target);
		});
	}

	stopListening(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
			this.emit = null;
		}
	}

	// ─── Private ───

	private handleClick(target: HTMLElement): void {
		if (!this.emit) return;

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
