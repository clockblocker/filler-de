/**
 * Selection toolbar - floating toolbar positioned above text selection.
 *
 * Creates a toolbar that appears above the user's text selection
 * with action buttons that can be clicked to trigger commands.
 */

import { DomSelectors } from "../../../utils/dom-selectors";
import type {
	ActionConfig,
	CreateSelectionToolbarOptions,
	SelectionToolbar,
} from "./types";

/**
 * Create a selection toolbar instance.
 */
export function createSelectionToolbar(
	_options: CreateSelectionToolbarOptions,
): SelectionToolbar {
	let toolbarEl: HTMLElement | null = null;
	let currentActions: ActionConfig[] = [];

	// ─── DOM Creation ───

	function createToolbarElement(): HTMLElement {
		const toolbar = document.createElement("div");
		toolbar.className = DomSelectors.SELECTION_TOOLBAR_CLASS;
		toolbar.style.position = "fixed";
		toolbar.style.display = "none";
		return toolbar;
	}

	function renderButtons(): void {
		if (!toolbarEl) return;
		toolbarEl.innerHTML = "";

		for (const action of currentActions) {
			const button = document.createElement("button");
			button.className = "selection-toolbar-btn";
			button.setAttribute("data-action", action.id);
			button.textContent = action.label;
			toolbarEl.appendChild(button);
		}
	}

	function positionToolbar(rect: DOMRect): void {
		if (!toolbarEl) return;

		// Ensure toolbar is rendered and measurable
		toolbarEl.style.display = "flex";
		toolbarEl.style.visibility = "hidden";

		// Calculate position
		const toolbarWidth = toolbarEl.offsetWidth;
		const toolbarHeight = toolbarEl.offsetHeight;
		const gap = 8;

		// Position above selection, centered horizontally
		let left = rect.left + rect.width / 2 - toolbarWidth / 2;
		let top = rect.top - toolbarHeight - gap;

		// Clamp to viewport
		const minMargin = 8;
		left = Math.max(
			minMargin,
			Math.min(left, window.innerWidth - toolbarWidth - minMargin),
		);
		top = Math.max(minMargin, top);

		// If toolbar would go above viewport, show below selection instead
		if (top < minMargin) {
			top = rect.bottom + gap;
		}

		toolbarEl.style.left = `${left}px`;
		toolbarEl.style.top = `${top}px`;
		toolbarEl.style.visibility = "visible";
	}

	// ─── Public Methods ───

	function show(rect: DOMRect): void {
		if (currentActions.length === 0) {
			hide();
			return;
		}

		// Create toolbar if it doesn't exist
		if (!toolbarEl) {
			toolbarEl = createToolbarElement();
			document.body.appendChild(toolbarEl);
			renderButtons();
		}

		positionToolbar(rect);
	}

	function hide(): void {
		if (toolbarEl) {
			toolbarEl.style.display = "none";
		}
	}

	function destroy(): void {
		if (toolbarEl) {
			toolbarEl.remove();
			toolbarEl = null;
		}
	}

	function setActions(actions: ActionConfig[]): void {
		currentActions = actions;
		if (toolbarEl) {
			renderButtons();
		}
	}

	return {
		destroy,
		hide,
		setActions,
		show,
	};
}
