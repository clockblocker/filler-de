import { Effect } from "effect";
import type { Editor, EditorPosition } from "obsidian";
import { VamVaultIoError } from "../../../effect/errors";
import { ActiveEditorAccess } from "../../../effect/ports";
import { errorNoActiveView } from "../../../errors";
import { DomSelectors } from "../../../internal/dom-selectors";
import { getErrorMessage } from "../../../internal/get-error-message";
import type { SplitPathToMdFile } from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import { computeLineChanges } from "./compute-line-changes";
import type { ActiveFileReader } from "./reader/active-file-reader";

export type SavedSelection = {
	anchor: EditorPosition;
	head: EditorPosition;
};

export type SavedInlineTitleSelection = {
	start: number;
	end: number;
	text: string;
};

function editorFailure(
	operation: string,
	message: string,
	path?: string,
	cause?: unknown,
): VamVaultIoError {
	return new VamVaultIoError({
		cause:
			cause === undefined
				? new Error(message)
				: new Error(message, { cause }),
		operation,
		path,
	});
}

export class ActiveFileWriter {
	constructor(private readonly reader: ActiveFileReader) {}

	replaceAllContentInActiveFile(content: string) {
		return this.reader.pwd().pipe(
			Effect.flatMap((path) =>
				path.kind === "MdFile"
					? this.processContent({
							splitPath: path,
							transform: () => content,
						})
					: Effect.fail(
							editorFailure(
								"replaceActiveFileContent",
								"Active file is not a markdown file",
							),
						),
			),
		);
	}

	saveSelection() {
		return this.reader.getEditorAnyMode().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"saveSelection",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => {
						const selection = editor.listSelections?.()[0];
						if (!selection) throw new Error("No selections");
						return {
							anchor: selection.anchor,
							head: selection.head,
						};
					},
				}),
			),
			Effect.catch(() => Effect.succeed(null)),
		);
	}

	restoreSelection(saved: SavedSelection) {
		return this.reader.getEditorAnyMode().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"restoreSelection",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.setSelection(saved.anchor, saved.head),
				}),
			),
		);
	}

	saveInlineTitleSelection() {
		return this.getMarkdownView().pipe(
			Effect.flatMap((view) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"saveInlineTitleSelection",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => {
						const element = view.contentEl.querySelector(
							DomSelectors.INLINE_TITLE,
						) as HTMLElement | null;
						if (!element)
							throw new Error("No inline title element");
						if (document.activeElement !== element) {
							throw new Error("Inline title not focused");
						}
						const selection = window.getSelection();
						if (!selection || selection.rangeCount === 0) {
							throw new Error("No selection");
						}
						const range = selection.getRangeAt(0);
						if (!element.contains(range.commonAncestorContainer)) {
							throw new Error("Selection not in element");
						}
						const text = element.textContent ?? "";
						const selectAll =
							range.startContainer === element ||
							range.endContainer === element;
						return {
							end: selectAll ? text.length : range.endOffset,
							start: selectAll ? 0 : range.startOffset,
							text,
						};
					},
				}),
			),
			Effect.catch(() => Effect.succeed(null)),
		);
	}

	restoreInlineTitleSelection(saved: SavedInlineTitleSelection) {
		return this.getMarkdownView().pipe(
			Effect.flatMap((view) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"restoreInlineTitleSelection",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => {
						const element = view.contentEl.querySelector(
							DomSelectors.INLINE_TITLE,
						) as HTMLElement | null;
						if (!element)
							throw new Error("No inline title element");
						element.focus();
						const selection = window.getSelection();
						if (!selection) throw new Error("No selection API");
						const textNode = element.firstChild;
						if (!textNode)
							throw new Error("No text node in inline title");
						const range = document.createRange();
						const textLength = textNode.textContent?.length ?? 0;
						range.setStart(
							textNode,
							Math.min(saved.start, textLength),
						);
						range.setEnd(textNode, Math.min(saved.end, textLength));
						selection.removeAllRanges();
						selection.addRange(range);
					},
				}),
			),
		);
	}

	replaceSelection(text: string) {
		return this.reader.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"replaceSelection",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.replaceSelection(text),
				}),
			),
		);
	}

	insertBelowCursor(text: string) {
		return this.reader.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"insertBelowCursor",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => {
						const selection = editor.listSelections?.()[0];
						const cursor = selection?.head ?? editor.getCursor();
						return editor.replaceRange(`\n${text}\n`, {
							ch: 0,
							line: Math.max(cursor.line + 1, 0),
						});
					},
				}),
			),
		);
	}

	processContent({
		splitPath,
		transform,
	}: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}) {
		return this.validateFileIsActive(splitPath).pipe(
			Effect.flatMap(({ editor, view }) =>
				this.applyTransformToEditor(editor, transform, view.file?.path),
			),
		);
	}

	scrollToLine(line: number) {
		return this.reader.getEditorAnyMode().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						editorFailure(
							"scrollToLine",
							getErrorMessage(cause),
							view.file?.path,
							cause,
						),
					try: () => {
						const pos = { ch: 0, line };
						editor.scrollIntoView({ from: pos, to: pos }, true);
					},
				}),
			),
			Effect.catch(() => Effect.void),
		);
	}

	private getMarkdownView() {
		return Effect.gen(function* () {
			const activeEditor = yield* ActiveEditorAccess;
			const view = yield* activeEditor.getActiveMarkdownView;
			return view
				? view
				: yield* editorFailure(
						"getActiveMarkdownView",
						errorNoActiveView(),
					);
		});
	}

	private validateFileIsActive(splitPath: SplitPathToMdFile) {
		return this.reader
			.isFileActive(splitPath)
			.pipe(
				Effect.flatMap((isActive) =>
					isActive
						? this.reader.getEditor()
						: Effect.fail(
								editorFailure(
									"validateActiveFile",
									"File is not active",
								),
							),
				),
			);
	}

	private applyTransformToEditor(
		editor: Editor,
		transform: Transform,
		path?: string,
	) {
		return Effect.gen(function* () {
			const before = yield* Effect.try({
				catch: (cause) =>
					editorFailure(
						"processActiveContent.read",
						getErrorMessage(cause),
						path,
						cause,
					),
				try: () => editor.getValue(),
			});
			const after = yield* Effect.tryPromise({
				catch: (cause) =>
					editorFailure(
						"processActiveContent.transform",
						getErrorMessage(cause),
						path,
						cause,
					),
				try: async () => transform(before),
			});
			if (after === before) return after;
			yield* Effect.try({
				catch: (cause) =>
					editorFailure(
						"processActiveContent.write",
						getErrorMessage(cause),
						path,
						cause,
					),
				try: () => {
					const changes = computeLineChanges(before, after);
					if (changes.length) editor.transaction({ changes });
				},
			});
			return after;
		});
	}
}
