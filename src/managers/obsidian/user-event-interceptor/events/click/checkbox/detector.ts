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
import type { VaultActionManager } from "../../../../vault-action-manager";
import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import {
	anyApplicable,
	executeChain,
	getBehaviorRegistry,
} from "../../../behavior-chain";
import type { BehaviorContext } from "../../../types/behavior";
import { PayloadKind } from "../../../types/payload-base";
import type { GenericClickDetector } from "../generic-click-detector";
import { CheckboxCodec } from "./codec";
import { executeCheckboxDefaultAction } from "./default-action";
import type { CheckboxPayload } from "./payload";

export class CheckboxClickedDetector {
	private unsubscribe: (() => void) | null = null;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	startListening(): void {
		if (this.unsubscribe) return;

		this.unsubscribe = this.genericClick.subscribe((target, _evt) => {
			void this.handleClick(target);
		});
	}

	stopListening(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	// ─── Private ───

	private async handleClick(target: HTMLElement): Promise<void> {
		// Check if it's a task checkbox
		if (!this.isTaskCheckbox(target)) return;

		// Get current file path
		const pwdResult = await this.vaultActionManager.pwd();
		if (pwdResult.isErr()) return;

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") return;

		const checkbox = target as HTMLInputElement;

		// Extract line content
		const lineContent = this.extractLineContent(checkbox);
		if (lineContent === null) return;

		// Encode to payload
		const payload = CheckboxCodec.encode({
			checked: checkbox.checked,
			lineContent,
			splitPath: splitPath as SplitPathToMdFile,
		});

		// Get behaviors for checkbox events
		const registry = getBehaviorRegistry();
		const behaviors = registry.getBehaviors<CheckboxPayload>(
			PayloadKind.CheckboxClicked,
		);

		// If no behaviors, nothing to do (Obsidian handles checkbox)
		if (behaviors.length === 0) return;

		// Check if any behavior is applicable
		if (!anyApplicable(payload, behaviors)) return;

		// Build context and execute chain
		const baseCtx: Omit<BehaviorContext<CheckboxPayload>, "data"> = {
			app: this.app,
			vaultActionManager: this.vaultActionManager,
		};

		const result = await executeChain(payload, behaviors, baseCtx);
		await executeCheckboxDefaultAction(result);
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
