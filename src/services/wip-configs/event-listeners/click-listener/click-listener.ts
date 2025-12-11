import type { Librarian } from "../../../../commanders/librarian/librarian";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";
import {
	extractCodexLinkTarget,
	parseCodexLinkTarget,
} from "./codex-link-target";
import { executeButtonAction } from "./execute-button-actions";

const isTaskCheckbox = (element: HTMLElement): element is HTMLInputElement =>
	element.tagName === "INPUT" &&
	(element as HTMLInputElement).type === "checkbox" &&
	element.classList.contains("task-list-item-checkbox");

import { handleLinkElementClicked } from "./handle-link-element-clicked";

type ClickListenerServices = TexfresserObsidianServices & {
	librarian: Librarian;
};

export const makeClickListener =
	(services: ClickListenerServices) => async (evt: PointerEvent) => {
		const target = evt.target as HTMLElement;

		// Handle checkbox clicks (Codex task lists)
		if (isTaskCheckbox(target)) {
			const lineContainer =
				target.closest(".cm-line") ??
				target.closest("li") ??
				target.parentElement;

			if (lineContainer) {
				const href = extractCodexLinkTarget(
					lineContainer,
					services.openedFileService.getApp(),
				);
				const { rootName, treePath } =
					href !== null
						? parseCodexLinkTarget(href)
						: { rootName: null, treePath: [] };

				if (rootName === "Library" && treePath.length > 0) {
					const newStatus = target.checked ? "Done" : "NotStarted";
					await services.librarian
						.setStatus(rootName, treePath, newStatus)
						.catch((error) =>
							console.error(
								"[click-listener] Failed to set status for checkbox click",
								error,
							),
						);
					evt.preventDefault();
					evt.stopPropagation();
					return;
				}
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
