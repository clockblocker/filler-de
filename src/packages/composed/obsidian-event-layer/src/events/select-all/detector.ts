/**
 * Ctrl/Cmd+A in a note's source view. A handler that takes it prevents
 * the native select-all, and may set a selection of its own. Not while the
 * user edits the note's title.
 */
import type { EditorView } from "@codemirror/view";
import { Effect } from "effect";
import { MarkdownView } from "obsidian";
import type { EventDispatch } from "../../internal/dispatch";
import { DomSelectors } from "../../internal/dom-selectors";
import { holdsMod } from "../../internal/platform";
import { PayloadKind } from "../../types/payload-base";
import { getCurrentFilePath } from "../get-current-file-path";
import { SelectAllCodec } from "./codec";

/** Listens for select-all while the scope is open, before the editor does. */
export const listenForSelectAll = Effect.fnUntraced(function* (
	dispatch: EventDispatch,
) {
	yield* dispatch.host.listen(
		"keydown",
		(evt) => handleKeydown(dispatch, evt),
		{ capture: true },
	);
});

function isSelectAll(evt: KeyboardEvent): boolean {
	return evt.key === "a" && holdsMod(evt) && !evt.shiftKey && !evt.altKey;
}

function handleKeydown(dispatch: EventDispatch, evt: KeyboardEvent): void {
	if (!isSelectAll(evt)) return;

	const { app, document } = dispatch.host;
	if (
		document.activeElement?.classList.contains(
			DomSelectors.INLINE_TITLE_CLASS,
		)
	)
		return;

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view || view.getMode() !== "source") return;

	// biome-ignore lint/suspicious/noExplicitAny: cm exists but is not typed in Obsidian's API
	const cm: EditorView | undefined = (view.editor as any).cm;
	if (!cm) return;

	const content = cm.state.doc.toString();
	if (!content) return;

	const payload = SelectAllCodec.encode({
		content,
		splitPath: getCurrentFilePath(app),
		view: cm,
	});
	const handler = dispatch.decide(PayloadKind.SelectAll, payload);
	// None: the native select-all proceeds.
	if (!handler) return;

	evt.preventDefault();
	evt.stopPropagation();

	// Passthrough, after the default was prevented, selects nothing.
	dispatch.run(
		PayloadKind.SelectAll,
		handler,
		Effect.succeed(payload),
		(result) =>
			result.outcome === "effect"
				? Effect.sync(() =>
						SelectAllCodec.applySelection(payload, result.effect),
					)
				: Effect.void,
	);
}
