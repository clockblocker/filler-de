/**
 * ActionElementDetector - detects clicks on [data-action] buttons.
 *
 * Handles:
 * - Toolbar buttons (bottom, selection)
 * - Edge zone divs
 * - Overflow menu items
 *
 * Note: Action elements typically don't use behavior chains since they
 * are already handled by the action executor system. This detector
 * primarily exists for compatibility and future extension.
 */

import { DomSelectors } from "../../../../../../utils/dom-selectors";
import type { VaultActionManager } from "../../../../vault-action-manager";
import {
	anyApplicable,
	executeChain,
	getBehaviorRegistry,
} from "../../../behavior-chain";
import type { BehaviorContext } from "../../../types/behavior";
import { PayloadKind } from "../../../types/payload-base";
import type { GenericClickDetector } from "../generic-click-detector";
import { ActionElementCodec } from "./codec";
import type { ActionElementPayload } from "./payload";
import type { App } from "obsidian";

export class ActionElementDetector {
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

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

		// Get behaviors for action element events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<ActionElementPayload>(
			PayloadKind.ActionElementClicked,
		);

		// If no behaviors, nothing to do (action executor handles actions)
		if (behaviors.length === 0) return;

		// Check if any behavior is applicable
		if (!anyApplicable(payload, behaviors)) return;

		// Build context and execute chain
		const baseCtx: Omit<BehaviorContext<ActionElementPayload>, "data"> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		// Execute chain (no default action for action elements)
		void executeChain(payload, behaviors, baseCtx);
	}
}
