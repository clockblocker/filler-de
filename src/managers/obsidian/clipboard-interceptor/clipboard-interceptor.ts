/**
 * ClipboardInterceptor - intercepts copy/cut events to strip redundant info from copied text.
 *
 * Strips:
 * - Metadata section: <section id="textfresser_meta_keep_me_invisible">...</section>
 * - Go-back links: [[__-L4-L3-L2-L1|← L4]]
 */

import { META_SECTION_PATTERN } from "../../pure/note-metadata-manager";
import { buildGoBackLinkPattern } from "../navigation";

export class ClipboardInterceptor {
	private handler: ((evt: ClipboardEvent) => void) | null = null;

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

		const goBackPattern = buildGoBackLinkPattern();
		const cleaned = selection
			.replace(goBackPattern, "")
			.replace(META_SECTION_PATTERN, "")
			.trim();

		if (cleaned !== selection) {
			evt.preventDefault();
			evt.clipboardData?.setData("text/plain", cleaned);
		}
	}
}
