/**
 * CheckboxClickedDetector - detects task checkbox clicks in markdown content.
 *
 * Handles:
 * - Task checkboxes (- [ ] / - [x])
 *
 * Subscribes to GenericClickDetector and filters for checkbox targets.
 */

import { type App, MarkdownView } from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import {
	decrementPending,
	incrementPending,
} from "../../../../../../utils/idle-tracker";
import type { VaultActionManager } from "../../../../vault-action-manager";
import { PayloadKind } from "../../../types/payload-base";
import type { HandlerInvoker } from "../../../user-event-interceptor";
import type { GenericClickDetector } from "../generic-click-detector";
import { CheckboxCodec } from "./codec";
import type { CheckboxPayload } from "./payload";

export class CheckboxClickedDetector {
	private unsubscribe: (() => void) | null = null;
	private readonly invoker: HandlerInvoker<CheckboxPayload>;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vam: VaultActionManager,
		createInvoker: (kind: PayloadKind) => HandlerInvoker<CheckboxPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.CheckboxClicked);
	}

	startListening(): void {
		if (this.unsubscribe) return;

		this.unsubscribe = this.genericClick.subscribe((target, evt) => {
			incrementPending();
			this.handleClick(target, evt).finally(() => decrementPending());
		});
	}

	stopListening(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	// ─── Private ───

	private async handleClick(
		target: HTMLElement,
		evt: MouseEvent,
	): Promise<void> {
		// Check if it's a task checkbox
		if (!this.isTaskCheckbox(target)) return;

		// Get current file path
		const splitPath = this.vam.mdPwd();
		if (!splitPath) return;

		const checkbox = target as HTMLInputElement;

		// Extract line content
		const lineContent = this.extractLineContent(checkbox);
		if (lineContent === null) return;

		// GenericClickDetector uses MOUSEDOWN in capture phase
		// mousedown fires BEFORE browser toggles checkbox
		// So checkbox.checked is PRE-toggle state (what user sees right now)
		const wasChecked = checkbox.checked;

		// Encode to payload
		const payload = CheckboxCodec.encode({
			checked: wasChecked,
			lineContent,
			splitPath: splitPath,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - let Obsidian handle checkbox toggle
			return;
		}

		// Handler applies - BLOCK Obsidian and browser completely
		// Block mousedown - GenericClickDetector will also block mouseup/click
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		await invoke();
	}

	private isTaskCheckbox(element: HTMLElement): element is HTMLInputElement {
		return (
			element.tagName === "INPUT" &&
			(element as HTMLInputElement).type === "checkbox" &&
			element.classList.contains(DomSelectors.TASK_CHECKBOX_CLASS)
		);
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
