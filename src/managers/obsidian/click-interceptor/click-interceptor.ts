/**
 * ClickInterceptor - listens to DOM click events and emits semantic click events.
 */

import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { logger } from "../../../utils/logger";
import type { VaultActionManager } from "../vault-action-manager";
import type { SplitPathToMdFile } from "../vault-action-manager/types/split-path";
import type {
	CheckboxClickedEvent,
	ClickEvent,
	ClickEventHandler,
	PropertyCheckboxClickedEvent,
	Teardown,
} from "./types/click-event";

export class ClickInterceptor {
	private readonly subscribers = new Set<ClickEventHandler>();
	private clickHandler: ((evt: MouseEvent) => void) | null = null;

	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	/**
	 * Subscribe to click events.
	 */
	subscribe(handler: ClickEventHandler): Teardown {
		this.subscribers.add(handler);
		return () => this.subscribers.delete(handler);
	}

	/**
	 * Start listening to DOM click events.
	 */
	startListening(): void {
		if (this.clickHandler) return; // Already listening

		this.clickHandler = (evt: MouseEvent) => {
			void this.handleClick(evt);
		};

		document.addEventListener("click", this.clickHandler);
	}

	/**
	 * Stop listening to DOM click events.
	 */
	stopListening(): void {
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
		}
	}

	// ─── Private ───

	private async handleClick(evt: MouseEvent): Promise<void> {
		const target = evt.target as HTMLElement;

		// Get current file path (needed for both types)
		const pwdResult = await this.vaultActionManager.pwd();
		if (pwdResult.isErr()) return;

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") return;

		// Check if it's a property checkbox (frontmatter)
		const propertyInfo = this.getPropertyCheckboxInfo(target);
		if (propertyInfo) {
			const event: PropertyCheckboxClickedEvent = {
				checked: propertyInfo.checked,
				kind: "PropertyCheckboxClicked",
				propertyName: propertyInfo.propertyName,
				splitPath: splitPath as SplitPathToMdFile,
			};
			this.emit(event);
			return;
		}

		// Check if it's a task checkbox
		if (!this.isTaskCheckbox(target)) return;

		const checkbox = target as HTMLInputElement;

		// Extract line content
		const lineContent = this.extractLineContent(checkbox);
		if (lineContent === null) {
			return;
		}

		// Emit event
		const event: CheckboxClickedEvent = {
			checked: checkbox.checked,
			kind: "CheckboxClicked",
			lineContent,
			splitPath: splitPath as SplitPathToMdFile,
		};

		this.emit(event);
	}

	private emit(event: ClickEvent): void {
		for (const handler of this.subscribers) {
			try {
				handler(event);
			} catch (error) {
				logger.error("[ClickInterceptor] Handler error:", error);
			}
		}
	}

	private isTaskCheckbox(element: HTMLElement): element is HTMLInputElement {
		return (
			element.tagName === "INPUT" &&
			(element as HTMLInputElement).type === "checkbox" &&
			element.classList.contains("task-list-item-checkbox")
		);
	}

	/**
	 * Check if element is a property checkbox and extract info.
	 * Returns null if not a property checkbox.
	 */
	private getPropertyCheckboxInfo(
		element: HTMLElement,
	): { propertyName: string; checked: boolean } | null {
		// Must be a checkbox input
		if (element.tagName !== "INPUT") return null;
		const input = element as HTMLInputElement;
		if (input.type !== "checkbox") return null;

		// Must be inside metadata/properties container
		const metadataContainer = element.closest(".metadata-container");
		if (!metadataContainer) return null;

		// Find the property row
		const propertyRow = element.closest(".metadata-property");
		if (!propertyRow) return null;

		// Get property name from the key element
		const keyElement = propertyRow.querySelector(".metadata-property-key");
		if (!keyElement) return null;

		const propertyName = keyElement.textContent?.trim();
		if (!propertyName) return null;

		return {
			checked: input.checked,
			propertyName,
		};
	}

	/**
	 * Extract line content after the checkbox prefix.
	 * Handles both Live Preview and Reading view.
	 */
	private extractLineContent(checkbox: HTMLInputElement): string | null {
		const lineContainer =
			checkbox.closest(".cm-line") ?? // Live Preview
			checkbox.closest("li") ?? // Reading view
			checkbox.parentElement;

		if (!lineContainer) return null;

		// Try to get line text from editor
		const editorLine = this.getLineFromEditor(lineContainer);
		if (editorLine) {
			return this.stripCheckboxPrefix(editorLine);
		}

		// Fallback: get text content from DOM
		const textContent = lineContainer.textContent;
		if (textContent) {
			return this.stripCheckboxPrefix(textContent);
		}

		return null;
	}

	/**
	 * Get line text from Obsidian's Editor API.
	 */
	private getLineFromEditor(lineElement: Element): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.editor) return null;

		const editor = view.editor;
		const cmContent = lineElement.closest(".cm-content");
		if (!cmContent) return null;

		const lines = Array.from(cmContent.querySelectorAll(".cm-line"));
		const lineIndex = lines.indexOf(lineElement as Element);
		if (lineIndex === -1) return null;

		return editor.getLine(lineIndex) ?? null;
	}

	/**
	 * Strip checkbox prefix from line.
	 * "- [ ] content" → "content"
	 * "- [x] content" → "content"
	 */
	private stripCheckboxPrefix(line: string): string {
		// Match "- [ ] " or "- [x] " or "- [X] " at start
		const match = line.match(/^[\s]*-\s*\[[xX\s]\]\s*/);
		if (match) {
			return line.slice(match[0].length);
		}
		return line.trim();
	}
}
