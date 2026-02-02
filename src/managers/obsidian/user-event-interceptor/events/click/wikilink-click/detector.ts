/**
 * WikilinkClickDetector - detects internal link (wikilink) clicks.
 *
 * Handles:
 * - Internal links in reading mode (a.internal-link)
 * - Internal links in edit mode (.cm-hmd-internal-link)
 *
 * Subscribes to GenericClickDetector and filters for wikilink targets.
 */

import { type App, MarkdownView } from "obsidian";
import { wikilinkHelper } from "../../../../../../stateless-helpers/wikilink";
import { DomSelectors } from "../../../../../../utils/dom-selectors";
import {
	decrementPending,
	incrementPending,
} from "../../../../../../utils/idle-tracker";
import {
	makeSystemPathForSplitPath,
	type VaultActionManager,
} from "../../../../vault-action-manager";
import { HandlerOutcome } from "../../../types/handler";
import { PayloadKind } from "../../../types/payload-base";
import type { HandlerInvoker } from "../../../user-event-interceptor";
import type { GenericClickDetector } from "../generic-click-detector";
import { WikilinkClickCodec } from "./codec";
import type { Modifiers, WikilinkClickPayload, WikiTarget } from "./payload";

export class WikilinkClickDetector {
	private unsubscribe: (() => void) | null = null;
	private readonly invoker: HandlerInvoker<WikilinkClickPayload>;

	constructor(
		private readonly genericClick: GenericClickDetector,
		private readonly app: App,
		private readonly vam: VaultActionManager,
		createInvoker: (
			kind: PayloadKind,
		) => HandlerInvoker<WikilinkClickPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.WikilinkClicked);
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
		// Check if it's an internal link
		const linkElement = this.findLinkElement(target);
		if (!linkElement) return;

		// Extract modifiers
		const modifiers: Modifiers = {
			alt: evt.altKey,
			ctrl: evt.ctrlKey,
			meta: evt.metaKey,
			shift: evt.shiftKey,
		};

		// If any modifier is held, always passthrough to let Obsidian handle (new tab, etc.)
		if (
			modifiers.ctrl ||
			modifiers.meta ||
			modifiers.shift ||
			modifiers.alt
		) {
			return;
		}

		// Get current file path
		const pwdResult = await this.vam.pwd();
		if (pwdResult.isErr()) return;

		const splitPath = pwdResult.value;
		if (splitPath.kind !== "MdFile") return;

		// Extract link data
		const wikiTarget = this.extractLinkData(linkElement, target);
		if (!wikiTarget) return;

		// Extract line content
		const blockContent = this.extractBlockContent(linkElement);
		if (blockContent === null) return;

		// Encode to payload
		const payload = WikilinkClickCodec.encode({
			blockContent,
			modifiers,
			splitPath,
			wikiTarget,
		});

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler - let Obsidian handle navigation
			return;
		}

		// Handler applies - prevent default and invoke
		evt.preventDefault();
		const result = await invoke();

		if (result.outcome === HandlerOutcome.Passthrough) {
			// Handler decided to passthrough - restore navigation that was prevented
			this.app.workspace.openLinkText(
				wikiTarget.basename,
				makeSystemPathForSplitPath(splitPath),
				false,
			);
		}
	}

	private findLinkElement(target: HTMLElement): HTMLElement | null {
		// Check for reading mode: a.internal-link
		const readingModeLink = target.closest(
			DomSelectors.INTERNAL_LINK,
		) as HTMLElement | null;
		if (readingModeLink) {
			return readingModeLink;
		}

		// Check for edit mode: .cm-hmd-internal-link
		const editModeLink = target.closest(
			DomSelectors.CM_INTERNAL_LINK,
		) as HTMLElement | null;
		if (editModeLink) {
			return editModeLink;
		}

		return null;
	}

	private extractLinkData(
		linkElement: HTMLElement,
		clickedElement: HTMLElement,
	): WikiTarget | null {
		// Reading mode: get from data-href attribute
		if (linkElement.classList.contains(DomSelectors.INTERNAL_LINK_CLASS)) {
			const href = linkElement.getAttribute(DomSelectors.DATA_HREF);
			if (!href) return null;

			const displayText = linkElement.textContent ?? href;
			// If displayText differs from href, it's an alias
			const alias = displayText !== href ? displayText : undefined;
			return { alias, basename: href };
		}

		// Edit mode: parse from line content
		return this.extractLinkDataFromEditMode(linkElement, clickedElement);
	}

	private extractLinkDataFromEditMode(
		linkElement: HTMLElement,
		clickedElement: HTMLElement,
	): WikiTarget | null {
		// In edit mode, the link spans might be split. Get the line and find the link.
		const lineElement = linkElement.closest(DomSelectors.CM_LINE);
		if (!lineElement) return null;

		const lineText = this.getLineFromEditor(lineElement);
		if (!lineText) return null;

		// Get clicked text to match against links
		const clickedText = clickedElement.textContent ?? "";

		// Find all wikilinks in the line using matcher
		const nextMatch = wikilinkHelper.createMatcher(lineText);
		let match = nextMatch();

		while (match !== null) {
			const basename = match.target;
			const alias = match.alias;
			const displayText = alias ?? basename;

			// Match by display text (may be partial due to CM spans)
			if (
				displayText.includes(clickedText) ||
				clickedText.includes(displayText)
			) {
				return { alias, basename };
			}
			match = nextMatch();
		}

		// Fallback: try to get any link from the line
		const simpleMatch = lineText.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
		if (simpleMatch?.[1]) {
			const basename = simpleMatch[1];
			const alias = simpleMatch[2]; // undefined if no alias
			return { alias, basename };
		}

		return null;
	}

	private extractBlockContent(linkElement: HTMLElement): string | null {
		const lineContainer =
			linkElement.closest(DomSelectors.CM_LINE) ??
			linkElement.closest("p") ??
			linkElement.closest("li") ??
			linkElement.parentElement;

		if (!lineContainer) return null;

		const editorLine = this.getLineFromEditor(lineContainer);
		if (editorLine) {
			return editorLine;
		}

		return lineContainer.textContent ?? null;
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
}
