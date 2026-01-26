/**
 * Bottom toolbar - DOM creation and lifecycle management.
 *
 * Creates a toolbar at the bottom of the active view content area
 * with action buttons that can be clicked to trigger commands.
 */

import { DomSelectors } from "../../../utils/dom-selectors";
import type { SplitPathToMdFile } from "../../obsidian/vault-action-manager/types/split-path";
import type { BottomToolbar, CreateBottomToolbarOptions } from "./types";

/**
 * Create a bottom toolbar instance.
 */
export function createBottomToolbar(
	options: CreateBottomToolbarOptions,
): BottomToolbar {
	const { container } = options;

	let toolbarEl: HTMLElement | null = null;
	let translateStubBtnEl: HTMLElement | null = null;
	let currentFilePath: SplitPathToMdFile | null = null;

	// ─── DOM Creation ───

	function createToolbarElement(): HTMLElement {
		const toolbar = document.createElement("div");
		toolbar.className = "tf-bottom-toolbar";

		// Create test button
		const testButton = document.createElement("button");
		testButton.className = "tf-bottom-toolbar-btn";
		testButton.setAttribute("data-action", "TestButton");
		testButton.textContent = "Test";
		toolbar.appendChild(testButton);

		// Create translate stub button (hidden by default)
		const translateStubButton = document.createElement("button");
		translateStubButton.className = "tf-bottom-toolbar-btn tf-contextual-btn";
		translateStubButton.setAttribute("data-action", "TranslateStub");
		translateStubButton.textContent = "Translate Stub";
		translateStubButton.style.display = "none";
		toolbar.appendChild(translateStubButton);
		translateStubBtnEl = translateStubButton;

		return toolbar;
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

	function updateSelectionContext(hasSelection: boolean): void {
		if (!translateStubBtnEl) return;
		translateStubBtnEl.style.display = hasSelection ? "" : "none";
	}

	return {
		destroy,
		getCurrentFilePath,
		hide,
		show,
		updateSelectionContext,
	};
}
