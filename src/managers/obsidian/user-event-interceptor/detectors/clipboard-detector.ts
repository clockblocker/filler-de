/**
 * ClipboardDetector - detects copy/cut events and provides callbacks for modification.
 *
 * Emits ClipboardCopyEvent with:
 * - Original selected text
 * - Whether it's cut or copy
 * - Callbacks to prevent default and set clipboard data
 *
 * Also handles block reference copying:
 * - When user copies with no selection and block ends with ^{id}
 * - Replaces clipboard with [[basename#^{id}|^]]
 *
 * Business logic (stripping metadata) is handled by subscribers.
 */

import { type App, MarkdownView } from "obsidian";
import {
	type ClipboardCopyEvent,
	InterceptableUserEventKind,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

/** Pattern to match block reference at end of text: space + ^ + alphanumeric/hyphens + optional whitespace */
const BLOCK_REF_PATTERN = /\s\^([a-zA-Z0-9-]+)\s*$/;

export class ClipboardDetector implements Detector {
	private handler: ((evt: ClipboardEvent) => void) | null = null;
	private emit: DetectorEmitter | null = null;

	constructor(private readonly app: App) {}

	startListening(emit: DetectorEmitter): void {
		if (this.handler) return;

		this.emit = emit;
		this.handler = (evt) => this.handleClipboard(evt);

		document.addEventListener("copy", this.handler);
		document.addEventListener("cut", this.handler);
	}

	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("copy", this.handler);
			document.removeEventListener("cut", this.handler);
			this.handler = null;
			this.emit = null;
		}
	}

	// ─── Private ───

	private handleClipboard(evt: ClipboardEvent): void {
		if (!this.emit) return;

		const selection = window.getSelection()?.toString();

		// No selection: handle block reference copy (copy only, not cut)
		if (!selection) {
			if (evt.type === "copy") {
				this.handleBlockReferenceCopy(evt);
			}
			return;
		}

		// Selection exists: emit event for subscribers
		const event: ClipboardCopyEvent = {
			isCut: evt.type === "cut",
			kind: InterceptableUserEventKind.ClipboardCopy,
			originalText: selection,
			preventDefault: () => evt.preventDefault(),
			setClipboardData: (text: string) => {
				evt.clipboardData?.setData("text/plain", text);
			},
		};

		this.emit(event);
	}

	/**
	 * Handle copy when no selection exists.
	 * If clipboard text ends with block ref ^{id}, replace with wikilink.
	 */
	private handleBlockReferenceCopy(evt: ClipboardEvent): void {
		const clipboardText = evt.clipboardData?.getData("text/plain");
		if (!clipboardText) return;

		const match = clipboardText.match(BLOCK_REF_PATTERN);
		if (!match) return;

		const blockId = match[1];
		const basename = this.getActiveFileBasename();
		if (!basename) return;

		const wikilink = `![[${basename}#^${blockId}|^]]`;

		evt.preventDefault();
		evt.clipboardData?.setData("text/plain", wikilink);
	}

	private getActiveFileBasename(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file?.basename ?? null;
	}
}
