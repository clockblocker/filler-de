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
				app: services.openedFileService.getApp(),
				checkbox: target,
				librarian: services.librarian,
			});
			if (handled) {
				// Prevent Obsidian's native checkbox handler from running
				// We fully control the checkbox state via setStatus and codex regeneration
				evt.preventDefault();
				evt.stopPropagation();
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
