/**
 * ActionElementDetector - detects clicks on [data-action] buttons.
 *
 * Handles:
 * - Toolbar buttons (bottom, selection)
 * - Edge zone divs
 * - Overflow menu items
 *
 * Note: Action elements typically don't use handlers since they
 * are already handled by the action executor system. This detector
 * primarily exists for compatibility and future extension.
 */

import type { App } from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import type { VaultActionManager } from "../../../../vault-action-manager";
import { PayloadKind } from "../../../types/payload-base";
import type { HandlerInvoker } from "../../../user-event-interceptor";
import type { GenericClickDetector } from "../generic-click-detector";
import { ActionElementCodec } from "./codec";
import type { ActionElementPayload } from "./payload";

export class ActionElementDetector {
	private unsubscribe: (() => void) | null = null;
	private readonly invoker: HandlerInvoker<ActionElementPayload>;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
		createInvoker: (kind: PayloadKind) => HandlerInvoker<ActionElementPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.ActionElementClicked);
	}

	startListening(): void {
		if (this.unsubscribe) return;

		this.unsubscribe = this.genericClick.subscribe((target, _evt) => {
			this.handleClick(target);
		});
	}

	stopListening(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	// ─── Private ───

	private handleClick(target: HTMLElement): void {
		const button = target.closest(
			DomSelectors.DATA_ACTION,
		) as HTMLElement | null;
		if (!button) return;

		// Skip disabled buttons
		if (button.hasAttribute("disabled")) return;

		const actionId = button.dataset[DomSelectors.DATA_ACTION_ATTR];
		if (!actionId) return;

		// Encode to payload
		const payload = ActionElementCodec.encode({
			actionId,
			button,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - action executor handles actions
			return;
		}

		// Invoke handler
		void invoke();
	}
}
