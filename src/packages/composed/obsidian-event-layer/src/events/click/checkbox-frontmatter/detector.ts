/**
 * Property checkbox clicks in a note's frontmatter. Obsidian toggles the
 * property either way; a handler is only told.
 */
import { Effect } from "effect";
import type { EventDispatch } from "../../../internal/dispatch";
import { DomSelectors } from "../../../internal/dom-selectors";
import { PayloadKind } from "../../../types/payload-base";
import { getCurrentFilePath } from "../../get-current-file-path";
import type { ClickSubscriber } from "../generic-click-detector";
import { CheckboxFrontmatterCodec } from "./codec";

export function frontmatterCheckboxClick(
	dispatch: EventDispatch,
): ClickSubscriber {
	const { app } = dispatch.host;
	return (target) => {
		const propertyInfo = getPropertyCheckboxInfo(target);
		if (!propertyInfo) return;

		const splitPath = getCurrentFilePath(app);
		if (!splitPath) return;

		const payload = CheckboxFrontmatterCodec.encode({
			checked: propertyInfo.checked,
			propertyName: propertyInfo.propertyName,
			splitPath,
		});

		const handler = dispatch.decide(
			PayloadKind.CheckboxInFrontmatterClicked,
			payload,
		);
		if (!handler) return;

		dispatch.run(
			PayloadKind.CheckboxInFrontmatterClicked,
			handler,
			Effect.succeed(payload),
		);
	};
}

function getPropertyCheckboxInfo(
	element: HTMLElement,
): { propertyName: string; checked: boolean } | null {
	if (element.tagName !== "INPUT") return null;
	const input = element as HTMLInputElement;
	if (input.type !== "checkbox") return null;

	const metadataContainer = element.closest(DomSelectors.METADATA_CONTAINER);
	if (!metadataContainer) return null;

	const propertyRow = element.closest(DomSelectors.METADATA_PROPERTY);
	if (!propertyRow) return null;

	const keyElement = propertyRow.querySelector(
		DomSelectors.METADATA_PROPERTY_KEY,
	);
	if (!keyElement) return null;

	const propertyName = keyElement.textContent?.trim();
	if (!propertyName) return null;

	return { checked: input.checked, propertyName };
}
