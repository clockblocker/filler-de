/**
 * ClickDetector - detects checkbox clicks in markdown files.
 *
 * Handles:
 * - Task checkboxes (- [ ] / - [x])
 * - Property checkboxes (frontmatter)
 */

import type { App } from "obsidian";
import { MarkdownView } from "obsidian";
import { DomSelectors } from "../../../../utils/dom-selectors";
import type { VaultActionManager } from "../../vault-action-manager";
import type { SplitPathToMdFile } from "../../vault-action-manager/types/split-path";
import {
	type CheckboxClickedEvent,
	InterceptableUserEventKind,
	type PropertyCheckboxClickedEvent,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class ClickDetector implements Detector {
	private clickHandler: ((evt: MouseEvent) => void) | null = null;
	private emit: DetectorEmitter | null = null;

	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(emit: DetectorEmitter): void {
		if (this.clickHandler) return;

		this.emit = emit;
		this.clickHandler = (evt: MouseEvent) => {
			void this.handleClick(evt);
		};

		document.addEventListener("click", this.clickHandler);
	}

	stopListening(): void {
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
			this.emit = null;
		}
	}

	// ─── Private ───

	private async handleClick(evt: MouseEvent): Promise<void> {
		if (!this.emit) return;

		const target = evt.target as HTMLElement;

		// Get current file path
		const pwdResult = await this.vaultActionManager.pwd();
		if (pwdResult.isErr()) return;

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") return;

		// Check if it's a property checkbox (frontmatter)
		const propertyInfo = this.getPropertyCheckboxInfo(target);
		if (propertyInfo) {
			const event: PropertyCheckboxClickedEvent = {
				checked: propertyInfo.checked,
				kind: InterceptableUserEventKind.PropertyCheckboxClicked,
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
		if (lineContent === null) return;

		const event: CheckboxClickedEvent = {
			checked: checkbox.checked,
			kind: InterceptableUserEventKind.CheckboxClicked,
			lineContent,
			splitPath: splitPath as SplitPathToMdFile,
		};

		this.emit(event);
	}

	private isTaskCheckbox(element: HTMLElement): element is HTMLInputElement {
		return (
			element.tagName === "INPUT" &&
			(element as HTMLInputElement).type === "checkbox" &&
			element.classList.contains(DomSelectors.TASK_CHECKBOX_CLASS)
		);
	}

	private getPropertyCheckboxInfo(
		element: HTMLElement,
	): { propertyName: string; checked: boolean } | null {
		if (element.tagName !== "INPUT") return null;
		const input = element as HTMLInputElement;
		if (input.type !== "checkbox") return null;

		const metadataContainer = element.closest(
			DomSelectors.METADATA_CONTAINER,
		);
		if (!metadataContainer) return null;

		const propertyRow = element.closest(DomSelectors.METADATA_PROPERTY);
		if (!propertyRow) return null;

		const keyElement = propertyRow.querySelector(
			DomSelectors.METADATA_PROPERTY_KEY,
		);
		if (!keyElement) return null;

		const propertyName = keyElement.textContent?.trim();
		if (!propertyName) return null;

		return {
			checked: input.checked,
			propertyName,
		};
	}

	private extractLineContent(checkbox: HTMLInputElement): string | null {
		const lineContainer =
			checkbox.closest(DomSelectors.CM_LINE) ??
			checkbox.closest("li") ??
			checkbox.parentElement;

		if (!lineContainer) return null;

		const editorLine = this.getLineFromEditor(lineContainer);
		if (editorLine) {
			return this.stripCheckboxPrefix(editorLine);
		}

		const textContent = lineContainer.textContent;
		if (textContent) {
			return this.stripCheckboxPrefix(textContent);
		}

		return null;
	}

	private getLineFromEditor(lineElement: Element): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.editor) return null;

		const editor = view.editor;
		const cmContent = lineElement.closest(DomSelectors.CM_CONTENT);
		if (!cmContent) return null;

		const lines = Array.from(
			cmContent.querySelectorAll(DomSelectors.CM_LINE),
		);
		const lineIndex = lines.indexOf(lineElement as Element);
		if (lineIndex === -1) return null;

		return editor.getLine(lineIndex) ?? null;
	}

	private stripCheckboxPrefix(line: string): string {
		const match = line.match(/^[\s]*-\s*\[[xX\s]\]\s*/);
		if (match) {
			return line.slice(match[0].length);
		}
		return line.trim();
	}
}
