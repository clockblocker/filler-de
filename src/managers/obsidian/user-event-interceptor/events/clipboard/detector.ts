/**
 * ClipboardDetector - detects copy/cut events with handler pattern.
 *
 * Flow:
 * 1. Capture clipboard event
 * 2. Encode to ClipboardPayload via codec
 * 3. Check if handler applies (sync)
 * 4. If applies: preventDefault, invoke handler, execute default action
 * 5. If not: let native behavior proceed
 */

import { type App, MarkdownView } from "obsidian";
import {
	BLOCK_ID_PATTERN,
	formatBlockEmbed,
} from "../../../../../pure-formatting-utils";
import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import { HandlerOutcome } from "../../types/handler";
import { PayloadKind } from "../../types/payload-base";
import type { HandlerInvoker } from "../../user-event-interceptor";
import { ClipboardCodec } from "./codec";
import type { ClipboardPayload } from "./payload";

export class ClipboardDetector {
	private handler: ((evt: ClipboardEvent) => void) | null = null;
	private readonly invoker: HandlerInvoker<ClipboardPayload>;

	constructor(
		private readonly app: App,
		createInvoker: (kind: PayloadKind) => HandlerInvoker<ClipboardPayload>,
	) {
		this.invoker = createInvoker(PayloadKind.ClipboardCopy);
	}

	startListening(): void {
		if (this.handler) return;

		this.handler = (evt) => this.handleClipboard(evt);

		document.addEventListener("copy", this.handler);
		document.addEventListener("cut", this.handler);
	}

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

		// No selection: handle block reference copy (copy only, not cut)
		if (!selection) {
			if (evt.type === "copy") {
				this.handleBlockReferenceCopy(evt);
			}
			return;
		}

		// Get current file path (may be null if no file open)
		const splitPath = this.getCurrentFilePath();

		// Encode to payload
		const payload = ClipboardCodec.encode(evt, selection, splitPath);

		// Check if handler applies
		const { applies, invoke } = this.invoker(payload);

		if (!applies) {
			// No handler applies - let native behavior proceed
			return;
		}

		// Handler applies - preventDefault and invoke
		evt.preventDefault();

		void invoke().then((result) => {
			if (result.outcome === HandlerOutcome.Passthrough) {
				// Handler decided to passthrough - but we already prevented default
				// Set clipboard to original text
				evt.clipboardData?.setData("text/plain", payload.originalText);
			} else if (
				result.outcome === HandlerOutcome.Modified &&
				result.data
			) {
				// Handler modified the payload - use modified text
				if (evt.clipboardData === null) return;
				ClipboardCodec.decode(result.data, evt.clipboardData);
			} else if (result.outcome === HandlerOutcome.Handled) {
				// Handler consumed the event - do nothing
			}
		});
	}

	/**
	 * Handle copy when no selection exists.
	 * If clipboard text ends with block ref ^{id}, replace with wikilink.
	 */
	private handleBlockReferenceCopy(evt: ClipboardEvent): void {
		const clipboardText = evt.clipboardData?.getData("text/plain");
		if (!clipboardText) return;

		const match = clipboardText.match(BLOCK_ID_PATTERN);
		if (!match) return;

		const blockId = match[1];
		const basename = this.getActiveFileBasename();
		if (!basename) return;

		const wikilink = formatBlockEmbed(basename, blockId);

		evt.preventDefault();
		evt.clipboardData?.setData("text/plain", wikilink);
	}

	private getActiveFileBasename(): string | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file?.basename ?? null;
	}

	private getCurrentFilePath(): SplitPathToMdFile | undefined {
		// Synchronously get current file path if available
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return undefined;

		const path = view.file.path;
		const parts = path.split("/");
		const filename = parts.pop() ?? "";
		const basename = filename.replace(/\.md$/, "");

		return {
			basename,
			extension: "md",
			kind: "MdFile",
			pathParts: parts,
		};
	}
}
