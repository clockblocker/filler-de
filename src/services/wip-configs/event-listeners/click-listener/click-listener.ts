import type { TexfresserObsidianServices } from "../../../services/obsidian-services/obsidian-services/interface";
import { executeButtonAction } from "./execute-button-actions";
import { handleLinkElementClicked } from "./handle-link-element-clicked";

export const makeClickListener =
	(services: TexfresserObsidianServices) => (evt: PointerEvent) => {
		const target = evt.target as HTMLElement;

		// Handle toolbar/overlay generic buttons
		const buttonElement = target.closest("button");

		if (buttonElement) {
			executeButtonAction({ buttonElement, services });
		}

		if (target.tagName === "A") {
			handleLinkElementClicked({ linkElement: target });
		}
	};
