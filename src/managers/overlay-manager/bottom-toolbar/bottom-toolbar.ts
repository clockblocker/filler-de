/**
 * Bottom toolbar - DOM creation and lifecycle management.
 *
 * Creates a toolbar at the bottom of the active view content area
 * with action buttons that can be clicked to trigger commands.
 */

import { DomSelectors } from "../../../utils/dom-selectors";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";
import type {
	ActionConfig,
	BottomToolbar,
	CreateBottomToolbarOptions,
} from "./types";

/**
 * Create a bottom toolbar instance.
 */
export function createBottomToolbar(
	options: CreateBottomToolbarOptions,
): BottomToolbar {
	const { container } = options;

	let toolbarEl: HTMLElement | null = null;
	let currentFilePath: SplitPathToMdFile | null = null;
	let currentActions: ActionConfig[] = [];
	let hasSelection = false;

	// ─── DOM Creation ───

	function createToolbarElement(): HTMLElement {
		const toolbar = document.createElement("div");
		toolbar.className = "tf-bottom-toolbar";
		return toolbar;
	}

	function renderButtons(): void {
		if (!toolbarEl) return;
		toolbarEl.innerHTML = "";

		for (const action of currentActions) {
			const button = document.createElement("button");
			const isContextual = action.contextual !== false;
			button.className = isContextual
				? "tf-bottom-toolbar-btn tf-contextual-btn"
				: "tf-bottom-toolbar-btn";
			button.setAttribute("data-action", action.id);
			button.textContent = action.label;
			// Set disabled state
			if (action.disabled) {
				button.disabled = true;
			}
			// Hide contextual buttons when no selection
			if (isContextual) {
				button.style.display = hasSelection ? "" : "none";
			}
			toolbarEl.appendChild(button);
		}

		updateToolbarVisibility();
	}

	function updateToolbarVisibility(): void {
		if (!toolbarEl) return;
		const hasVisibleButtons = toolbarEl.querySelector(
			'.tf-bottom-toolbar-btn:not([style*="display: none"])',
		);
		toolbarEl.style.display = hasVisibleButtons ? "" : "none";
	}

	// ─── Public Methods ───

	function show(filePath: SplitPathToMdFile): void {
		currentFilePath = filePath;

		// Add host class to container for positioning
		container.classList.add(DomSelectors.BOTTOM_OVERLAY_HOST_CLASS);

		// Create toolbar if it doesn't exist
		if (!toolbarEl) {
			toolbarEl = createToolbarElement();
			container.appendChild(toolbarEl);
			renderButtons();
		}
	}

	function hide(): void {
		currentFilePath = null;

		// Remove host class
		container.classList.remove(DomSelectors.BOTTOM_OVERLAY_HOST_CLASS);

		// Remove toolbar element
		if (toolbarEl) {
			toolbarEl.remove();
			toolbarEl = null;
		}
	}

	function destroy(): void {
		hide();
	}

	function getCurrentFilePath(): SplitPathToMdFile | null {
		return currentFilePath;
	}

	function updateSelectionContext(newHasSelection: boolean): void {
		hasSelection = newHasSelection;
		if (!toolbarEl) return;

		// Update visibility of contextual buttons
		const buttons = toolbarEl.querySelectorAll(".tf-contextual-btn");
		for (const button of Array.from(buttons)) {
			if (button instanceof HTMLElement) {
				button.style.display = hasSelection ? "" : "none";
			}
		}
		updateToolbarVisibility();
	}

	function setActions(actions: ActionConfig[]): void {
		currentActions = actions;
		if (toolbarEl) {
			renderButtons();
		}
	}

	return {
		destroy,
		getCurrentFilePath,
		hide,
		setActions,
		show,
		updateSelectionContext,
	};
}
