/**
 * Changes of the editor's selection: by mouse (mouseup), by keyboard
 * (keyup of a selection key) and by drag (dragend). A mouseup on an action
 * button is the button's click, not a selection.
 *
 * These are frequent, so the layer runs them untraced.
 */
import { Effect } from "effect";
import { MarkdownView } from "obsidian";
import type { EventDispatch } from "../../internal/dispatch";
import { DomSelectors } from "../../internal/dom-selectors";
import { PayloadKind } from "../../types/payload-base";
import { getCurrentFilePath } from "../get-current-file-path";
import { SelectionChangedCodec } from "./codec";
import type { SelectionChangedPayload } from "./payload";

const SELECTION_KEYS = new Set([
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	"Shift",
	"Home",
	"End",
	"PageUp",
	"PageDown",
	// Ctrl/Cmd+A, whose own case is the select-all detector's.
	"a",
]);

/** Listens for selection changes while the scope is open. */
export const listenForSelectionChanges = Effect.fnUntraced(function* (
	dispatch: EventDispatch,
) {
	const { listen } = dispatch.host;
	yield* listen("mouseup", (evt) => {
		const target = evt.target as HTMLElement;
		if (target.closest?.(DomSelectors.DATA_ACTION)) return;
		emit(dispatch, "mouse");
	});
	yield* listen("keyup", (evt) => {
		if (!evt.shiftKey && !SELECTION_KEYS.has(evt.key)) return;
		emit(dispatch, "keyboard");
	});
	yield* listen("dragend", () => emit(dispatch, "drag"));
});

function emit(
	dispatch: EventDispatch,
	source: SelectionChangedPayload["source"],
): void {
	const { app } = dispatch.host;
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const selectedText = view?.editor?.getSelection() ?? "";

	const payload = SelectionChangedCodec.encode({
		hasSelection: selectedText.length > 0,
		selectedText,
		source,
		splitPath: getCurrentFilePath(app),
	});
	const handler = dispatch.decide(PayloadKind.SelectionChanged, payload);
	if (!handler) return;

	dispatch.run(
		PayloadKind.SelectionChanged,
		handler,
		Effect.succeed(payload),
	);
}
