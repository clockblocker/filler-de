/**
 * ClipboardInterceptor - intercepts copy/cut events to strip metadata from copied text.
 */

import { META_SECTION_PATTERN } from "../../pure/note-metadata-manager/impl";

export class ClipboardInterceptor {
	private handler: ((evt: ClipboardEvent) => void) | null = null;

	constructor() {}

	/**
	 * Start listening to clipboard events.
	 */
	startListening(): void {
		if (this.handler) return;

		this.handler = (evt) => this.handleClipboard(evt);
		document.addEventListener("copy", this.handler);
		document.addEventListener("cut", this.handler);
	}

	/**
	 * Stop listening to clipboard events.
	 */
	stopListening(): void {
		if (this.handler) {
			document.removeEventListener("copy", this.handler);
			document.removeEventListener("cut", this.handler);
			this.handler = null;
		}
	}

	// ─── Private ───

	private handleClipboard(evt: ClipboardEvent): void {
		const selection = window.getSelection()?.toString();
		if (!selection) return;

		const cleaned = selection.replace(META_SECTION_PATTERN, "").trim();
		if (cleaned !== selection) {
			evt.preventDefault();
			evt.clipboardData?.setData("text/plain", cleaned);
		}
	}
}
