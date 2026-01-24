/**
 * CheckboxFrontmatterDetector - detects property checkbox clicks in frontmatter.
 *
 * Handles:
 * - Property checkboxes (frontmatter boolean properties)
 *
 * Subscribes to GenericClickDetector and filters for property checkbox targets.
 */

import type { App } from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import type { VaultActionManager } from "../../../../vault-action-manager";
import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import { PayloadKind } from "../../../types/payload-base";
import type { HandlerInvoker } from "../../../user-event-interceptor";
import type { GenericClickDetector } from "../generic-click-detector";
import { CheckboxFrontmatterCodec } from "./codec";
import type { CheckboxFrontmatterPayload } from "./payload";

export class CheckboxFrontmatterDetector {
	private unsubscribe: (() => void) | null = null;
	private readonly invoker: HandlerInvoker<CheckboxFrontmatterPayload>;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
		createInvoker: (kind: PayloadKind) => HandlerInvoker<CheckboxFrontmatterPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.CheckboxInFrontmatterClicked);
	}

	startListening(): void {
		if (this.unsubscribe) return;

		this.unsubscribe = this.genericClick.subscribe((target, _evt) => {
			void this.handleClick(target);
		});
	}

	stopListening(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	// ─── Private ───

	private async handleClick(target: HTMLElement): Promise<void> {
		// Check if it's a property checkbox
		const propertyInfo = this.getPropertyCheckboxInfo(target);
		if (!propertyInfo) return;

		// Get current file path
		const pwdResult = await this.vaultActionManager.pwd();
		if (pwdResult.isErr()) return;

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") return;

		// Encode to payload
		const payload = CheckboxFrontmatterCodec.encode({
			checked: propertyInfo.checked,
			propertyName: propertyInfo.propertyName,
			splitPath: splitPath as SplitPathToMdFile,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - let Obsidian handle property toggle
			return;
		}

		// Invoke handler (property toggle handled by Obsidian)
		await invoke();
	}

	private getPropertyCheckboxInfo(
		element: HTMLElement,
	): { propertyName: string; checked: boolean } | null {
		if (element.tagName !== "INPUT") return null;
		const input = element as HTMLInputElement;
		if (input.type !== "checkbox") return null;

		const metadataContainer = element.closest(
			DomSelectors.METADATA_CONTAINER,
		);
		if (!metadataContainer) return null;

		const propertyRow = element.closest(DomSelectors.METADATA_PROPERTY);
		if (!propertyRow) return null;

		const keyElement = propertyRow.querySelector(
			DomSelectors.METADATA_PROPERTY_KEY,
		);
		if (!keyElement) return null;

		const propertyName = keyElement.textContent?.trim();
		if (!propertyName) return null;

		return {
			checked: input.checked,
			propertyName,
		};
	}
}
