/**
 * ClickManager - listens to DOM click events and emits semantic click events.
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
	Teardown,
} from "./types/click-event";

export class ClickManager {
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

		// Check if it's a task checkbox
		if (!this.isTaskCheckbox(target)) return;

		const checkbox = target as HTMLInputElement;

		// Get current file path
		const pwdResult = await this.vaultActionManager.pwd();
		if (pwdResult.isErr()) {
			return;
		}

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") {
			return;
		}

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
				logger.error("[ClickManager] Handler error:", error);
			}
		}
	}

	private isTaskCheckbox(element: HTMLElement): element is HTMLInputElement {
		return (
			element.tagName === "INPUT" &&
			(element as HTMLInputElement).kind === "checkbox" &&
			element.classList.contains("task-list-item-checkbox")
		);
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
