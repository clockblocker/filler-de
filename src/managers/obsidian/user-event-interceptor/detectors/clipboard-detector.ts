/**
 * ClipboardDetector - detects copy/cut events and provides callbacks for modification.
 *
 * Emits ClipboardCopyEvent with:
 * - Original selected text
 * - Whether it's cut or copy
 * - Callbacks to prevent default and set clipboard data
 *
 * Business logic (stripping metadata) is handled by subscribers.
 */

import {
	InterceptableUserEventKind,
	type ClipboardCopyEvent,
} from "../types/user-event";
import type { Detector, DetectorEmitter } from "./detector";

export class ClipboardDetector implements Detector {
	private handler: ((evt: ClipboardEvent) => void) | null = null;
	private emit: DetectorEmitter | null = null;

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
		if (!selection) return;

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
}
