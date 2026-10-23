/**
 * Copy and cut.
 *
 * With a selection, a handler that takes it prevents the native copy and
 * puts its own text on the clipboard: its modified text, or for
 * passthrough the selection as it is. The clipboard is writable only while
 * the event is dispatched, so the handler must answer without waiting. One
 * that waits finds the event over: the selection as it is was copied, and
 * its answer is logged and dropped.
 *
 * The selection is read as the event begins, in the capture phase: by the
 * time the event bubbles to the document, CodeMirror's own handler has put
 * the raw selection on the clipboard and, for a cut, deleted it. The
 * clipboard text is written as it bubbles, after CodeMirror's.
 *
 * With no selection, a copy whose text ends in a block reference `^id`
 * copies the block's embed instead, `![[basename#^id]]`.
 */
import { Effect, Exit, MutableRef, Ref } from "effect";
import { type App, MarkdownView } from "obsidian";
import type { UserEventKind, UserEventResult } from "../../contracts";
import { blockIdHelper } from "../../internal/block-id";
import type { EventDispatch } from "../../internal/dispatch";
import { PayloadKind } from "../../types/payload-base";
import { getCurrentFilePath } from "../get-current-file-path";
import { ClipboardCodec } from "./codec";

type Result = UserEventResult<typeof UserEventKind.ClipboardCopy>;

/** The selection a copy or cut began with, read before CodeMirror's handler. */
type Began = { readonly event: Event; readonly selection: string | undefined };

/** Listens for copy and cut while the scope is open. */
export const listenForClipboard = Effect.fnUntraced(function* (
	dispatch: EventDispatch,
) {
	const { listen } = dispatch.host;
	const began = yield* Ref.make<Began | null>(null);
	const onBegin = (event: ClipboardEvent) =>
		MutableRef.set(began.ref, {
			event,
			selection: readSelection(dispatch),
		});
	const onClipboard = (evt: ClipboardEvent) => {
		const start = Ref.getUnsafe(began);
		MutableRef.set(began.ref, null);
		handleClipboard(
			dispatch,
			evt,
			start?.event === evt ? start.selection : readSelection(dispatch),
		);
	};
	yield* listen("copy", onBegin, { capture: true });
	yield* listen("cut", onBegin, { capture: true });
	yield* listen("copy", onClipboard);
	yield* listen("cut", onClipboard);
});

/**
 * The selection now. VAM reads the editor's, which CodeMirror may not have
 * rendered in full; the document's selection is the fallback.
 */
function readSelection({ host }: EventDispatch): string | undefined {
	const read = host.readSync(host.vam.getSelectionText());
	return (
		(Exit.isSuccess(read) ? read.value : null) ??
		host.document.getSelection?.()?.toString()
	);
}

function handleClipboard(
	dispatch: EventDispatch,
	evt: ClipboardEvent,
	selection: string | undefined,
): void {
	const { app } = dispatch.host;

	if (!selection) {
		if (evt.type === "copy") copyBlockReference(app, evt);
		return;
	}

	const payload = ClipboardCodec.encode(
		evt,
		selection,
		getCurrentFilePath(app),
	);
	const handler = dispatch.decide(PayloadKind.ClipboardCopy, payload);
	// None: the native copy proceeds.
	if (!handler) return;

	evt.preventDefault();
	const clipboard = evt.clipboardData;
	// Whether the event is still dispatched, and nothing was copied yet.
	let open = true;
	const copy = (result: Result) => {
		if (result.outcome === "passthrough")
			clipboard?.setData("text/plain", payload.originalText);
		else if (result.outcome === "effect" && clipboard)
			ClipboardCodec.applyEffect(result.effect, clipboard);
	};

	dispatch.run(
		PayloadKind.ClipboardCopy,
		handler,
		Effect.succeed(payload),
		(result) =>
			Effect.suspend(() => {
				if (!open)
					return Effect.logWarning(
						"[ClipboardDetector] The copy handler answered after the copy ended; the selection was copied as it is",
					);
				open = false;
				return Effect.sync(() => copy(result));
			}),
	);
	if (open) {
		open = false;
		copy({ outcome: "passthrough" });
	}
}

/**
 * A copy with no selection: when its text ends in a block reference,
 * copies the block's embed instead.
 */
function copyBlockReference(app: App, evt: ClipboardEvent): void {
	const clipboardText = evt.clipboardData?.getData("text/plain");
	if (!clipboardText) return;

	const match = blockIdHelper.matchesPattern(clipboardText);
	if (!match) return;

	const basename =
		app.workspace.getActiveViewOfType(MarkdownView)?.file?.basename;
	if (!basename) return;

	evt.preventDefault();
	evt.clipboardData?.setData(
		"text/plain",
		blockIdHelper.formatEmbed(basename, match.id),
	);
}
