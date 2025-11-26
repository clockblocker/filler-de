import type { Librarian } from "../../../../commanders/librarian/librarian";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";
import { executeButtonAction } from "./execute-button-actions";
import {
	handleCheckboxClicked,
	isTaskCheckbox,
} from "./handle-checkbox-clicked";
import { handleLinkElementClicked } from "./handle-link-element-clicked";

type ClickListenerServices = TexfresserObsidianServices & {
	librarian: Librarian;
};

export const makeClickListener =
	(services: ClickListenerServices) => (evt: PointerEvent) => {
		const target = evt.target as HTMLElement;

		// Handle checkbox clicks (Codex task lists)
		if (isTaskCheckbox(target)) {
			const handled = handleCheckboxClicked({
				checkbox: target,
				librarian: services.librarian,
				app: services.openedFileService.getApp(),
			});
			if (handled) {
				// Don't prevent default - let Obsidian update the checkbox visually
				return;
			}
		}

		// Handle toolbar/overlay generic buttons
		const buttonElement = target.closest("button");

		if (buttonElement) {
			executeButtonAction({ buttonElement, services });
		}

		if (target.tagName === "A") {
			handleLinkElementClicked({ linkElement: target });
		}
	};
