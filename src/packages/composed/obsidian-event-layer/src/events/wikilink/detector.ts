/**
 * Wikilink completions, in an editor extension the host can switch off.
 *
 * Detects two cases:
 * 1. The cursor right after `]]`: the user typed the closing brackets.
 * 2. A selection wrapped in `[[…]]`: the user selected text and typed `[`
 *    twice, and Obsidian wrapped the selection each time.
 *
 * Ignores undo and redo, so a rewrite stays undoable.
 *
 * Skips (`completedLinkAt`) a link that already has an alias (`|`), a
 * nested link, a link spanning lines, and empty content.
 *
 * As the completion is handled, VAM resolves the link from its source note
 * (`resolveLinkpath`), and the payload carries where it resolves and
 * whether it is an embed, so the handler can tell a link to a Library or
 * other note from a word to land on its Crossroad note. The handler's edit
 * is dispatched a microtask later, once every update listener has seen the
 * completing update, and dropped if the editor no longer holds the link.
 */
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { Effect } from "effect";
import type { EventDispatch } from "../../internal/dispatch";
import { PayloadKind } from "../../types/payload-base";
import { getCurrentFilePath } from "../get-current-file-path";
import { WikilinkCodec } from "./codec";
import { type CompletedLink, completedLinkAt } from "./link-at";

/** The editor extension that answers completed links. */
export function wikilinkCompletionExtension(dispatch: EventDispatch) {
	return EditorView.updateListener.of((vu) => onEditorUpdate(dispatch, vu));
}

function onEditorUpdate(dispatch: EventDispatch, vu: ViewUpdate): void {
	if (!vu.docChanged) return;
	// Undoing a rewrite brings the completed link back; answering it again
	// would make the rewrite impossible to undo.
	if (
		vu.transactions.some(
			(tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo"),
		)
	)
		return;

	const link = detectCursorAfterClose(vu) ?? detectWrappedSelection(vu);
	if (!link) return;

	const { app, vam } = dispatch.host;
	const currentFile = getCurrentFilePath(app);
	const payload = {
		...WikilinkCodec.encode({ link, view: vu.view }),
		sourcePath: currentFile
			? [...currentFile.pathParts, `${currentFile.basename}.md`].join("/")
			: undefined,
	};

	const handler = dispatch.decide(PayloadKind.WikilinkCompleted, payload);
	if (!handler) return;

	const { sourcePath } = payload;
	dispatch.run(
		PayloadKind.WikilinkCompleted,
		handler,
		// Where Obsidian resolves the link from its source note, if anywhere.
		(sourcePath === undefined
			? Effect.succeed(null)
			: vam.resolveLinkpath(payload.linkContent, sourcePath)
		).pipe(
			Effect.map((resolved) => ({
				...payload,
				resolvedPath: resolved ?? undefined,
			})),
		),
		(result) =>
			result.outcome === "effect"
				? Effect.andThen(
						afterTheUpdate,
						Effect.sync(() => {
							if ("resolvedTarget" in result.effect) {
								WikilinkCodec.replaceTarget(
									payload,
									result.effect,
								);
								return;
							}
							WikilinkCodec.insertAlias(payload, result.effect);
						}),
					)
				: Effect.void,
	);
}

/**
 * Waits a microtask, in the same fiber: the editor change is dispatched
 * once CodeMirror's update listeners, ours among them, have all seen the
 * update that completed the link, never from inside one. Code that
 * completed the link, such as a `replaceRange`, also reads its own text
 * back before the rewrite lands.
 */
const afterTheUpdate = Effect.promise(() => Promise.resolve());

/** Case 1: the cursor right after `]]`, typed by hand. */
function detectCursorAfterClose(vu: ViewUpdate): CompletedLink | null {
	const cursor = vu.state.selection.main.head;
	// Every keystroke comes here: the whole text is read only after `]]`.
	if (vu.state.sliceDoc(cursor - 2, cursor) !== "]]") return null;

	return completedLinkAt(vu.state.doc.toString(), cursor - 2);
}

/** Case 2: a selection wrapped in `[[…]]`, as Obsidian wraps it. */
function detectWrappedSelection(vu: ViewUpdate): CompletedLink | null {
	const sel = vu.state.selection.main;
	if (sel.from === sel.to) return null;

	if (vu.state.sliceDoc(sel.from - 2, sel.from) !== "[[") return null;
	if (vu.state.sliceDoc(sel.to, sel.to + 2) !== "]]") return null;

	return completedLinkAt(vu.state.doc.toString(), sel.to);
}
