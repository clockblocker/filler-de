import { Effect } from "effect";
import type { EditorPosition } from "obsidian";
import type { SavedInlineTitleSelection } from "../../../effect/ports";
import { pathfinder } from "../../../helpers/pathfinder";
import { getErrorMessage } from "../../../internal/get-error-message";
import type { SplitPathToMdFile } from "../../../types/split-path";
import type { Transform } from "../../../types/vault-action";
import {
	type ActiveEditorSnapshot,
	activeEditorFailure,
	assertSnapshotCurrent,
	type SourceActiveEditorSnapshot,
} from "../active-editor-snapshot";
import { annotateFileAccessFailure } from "../tracing";
import { computeLineChanges } from "./compute-line-changes";
import type { ActiveFileReader } from "./reader/active-file-reader";

export type SavedSelection = {
	anchor: EditorPosition;
	head: EditorPosition;
};

export type { SavedInlineTitleSelection } from "../../../effect/ports";

export class ActiveFileWriter {
	constructor(private readonly reader: ActiveFileReader) {}

	replaceAllContentInActiveFile(
		content: string,
		snapshot?: ActiveEditorSnapshot,
	) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				this.applyTransformToEditor(current, () => content),
			),
			Effect.withSpan("vam.activeEditor.transform", {
				attributes: { kind: "replace-all", operation: "transform" },
			}),
		);
	}

	saveSelection(snapshot?: ActiveEditorSnapshot) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"ReadFailure",
							"saveSelection",
							getErrorMessage(cause),
							current.path,
							cause,
						),
					try: () => {
						const selection = current.primarySelection;
						if (!selection) throw new Error("No selections");
						return {
							anchor: selection.anchor,
							head: selection.head,
						};
					},
				}),
			),
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.read.selection", {
				attributes: { kind: "save", operation: "read-selection" },
			}),
		);
	}

	restoreSelection(saved: SavedSelection, snapshot?: ActiveEditorSnapshot) {
		return (
			snapshot ? Effect.succeed(snapshot) : this.reader.snapshot()
		).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(current, "restoreSelection").pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"WriteFailure",
									"restoreSelection",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () =>
								current.editor.setSelection(
									saved.anchor,
									saved.head,
								),
						}),
					),
				),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.selectionMutation", {
				attributes: {
					kind: "restore",
					operation: "selection-mutation",
				},
			}),
		);
	}

	saveInlineTitleSelection(snapshot?: ActiveEditorSnapshot) {
		return (
			snapshot ? Effect.succeed(snapshot) : this.reader.snapshot()
		).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(current, "saveInlineTitleSelection").pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"DomFailure",
									"saveInlineTitleSelection",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () => current.readInlineTitleSelection(),
						}),
					),
				),
			),
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.read.inlineTitleSelection", {
				attributes: { operation: "read-inline-title-selection" },
			}),
		);
	}

	restoreInlineTitleSelection(
		saved: SavedInlineTitleSelection,
		snapshot?: ActiveEditorSnapshot,
	) {
		return (
			snapshot ? Effect.succeed(snapshot) : this.reader.snapshot()
		).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(
					current,
					"restoreInlineTitleSelection",
				).pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"DomFailure",
									"restoreInlineTitleSelection",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () =>
								current.restoreInlineTitleSelection(saved),
						}),
					),
				),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.selectionMutation", {
				attributes: {
					kind: "restore-inline-title",
					operation: "selection-mutation",
				},
			}),
		);
	}

	replaceSelection(text: string, snapshot?: ActiveEditorSnapshot) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(current, "replaceSelection").pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"WriteFailure",
									"replaceSelection",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () => current.editor.replaceSelection(text),
						}),
					),
				),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.selectionMutation", {
				attributes: {
					kind: "replace",
					operation: "selection-mutation",
				},
			}),
		);
	}

	insertBelowCursor(text: string, snapshot?: ActiveEditorSnapshot) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(current, "insertBelowCursor").pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"WriteFailure",
									"insertBelowCursor",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () => {
								const selection = current.primarySelection;
								const cursor =
									selection?.head ??
									current.editor.getCursor();
								return current.editor.replaceRange(
									`\n${text}\n`,
									{
										ch: 0,
										line: Math.max(cursor.line + 1, 0),
									},
								);
							},
						}),
					),
				),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.selectionMutation", {
				attributes: {
					kind: "insert-below",
					operation: "selection-mutation",
				},
			}),
		);
	}

	replaceLine(
		args: {
			readonly after: string;
			readonly before: string;
			readonly line: number;
			readonly splitPath: SplitPathToMdFile;
		},
		snapshot?: ActiveEditorSnapshot,
	) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				Effect.gen(function* () {
					yield* assertSnapshotCurrent(current, "replaceLine");
					const expectedPath = pathfinder.systemPathFromSplitPath(
						args.splitPath,
					);
					if (current.path !== expectedPath) {
						return yield* activeEditorFailure(
							"IdentityMismatch",
							"replaceLine.revalidate",
							`Expected active editor ${expectedPath}, got ${current.path}`,
							expectedPath,
						);
					}
					const lineContent = yield* Effect.try({
						catch: (cause) =>
							activeEditorFailure(
								"ReadFailure",
								"replaceLine.revalidate",
								getErrorMessage(cause),
								current.path,
								cause,
							),
						try: () => current.editor.getLine(args.line),
					});
					if (lineContent !== args.before) {
						return yield* activeEditorFailure(
							"IdentityMismatch",
							"replaceLine.revalidate",
							"Editor line changed after the snapshot was captured",
							current.path,
						);
					}
					yield* Effect.try({
						catch: (cause) =>
							activeEditorFailure(
								"WriteFailure",
								"replaceLine",
								getErrorMessage(cause),
								current.path,
								cause,
							),
						try: () =>
							current.editor.setLine(args.line, args.after),
					});
				}),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.selectionMutation", {
				attributes: {
					kind: "replace-line",
					operation: "selection-mutation",
				},
			}),
		);
	}

	processContent(
		{
			splitPath,
			transform,
		}: {
			splitPath: SplitPathToMdFile;
			transform: Transform;
		},
		snapshot?: ActiveEditorSnapshot,
	) {
		return this.reader.sourceSnapshot(snapshot).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) => {
				const expectedPath =
					pathfinder.systemPathFromSplitPath(splitPath);
				if (current.path !== expectedPath) {
					return Effect.fail(
						activeEditorFailure(
							"IdentityMismatch",
							"processActiveContent",
							`Expected active editor ${expectedPath}, got ${current.path}`,
							expectedPath,
						),
					);
				}
				return this.applyTransformToEditor(current, transform);
			}),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.transform", {
				attributes: { operation: "transform" },
			}),
		);
	}

	scrollToLine(line: number, snapshot?: ActiveEditorSnapshot) {
		return (
			snapshot ? Effect.succeed(snapshot) : this.reader.snapshot()
		).pipe(
			Effect.tap(annotateSnapshotPath),
			Effect.flatMap((current) =>
				assertSnapshotCurrent(current, "scrollToLine").pipe(
					Effect.andThen(
						Effect.try({
							catch: (cause) =>
								activeEditorFailure(
									"NavigationFailure",
									"scrollToLine",
									getErrorMessage(cause),
									current.path,
									cause,
								),
							try: () => {
								const pos = { ch: 0, line };
								current.editor.scrollIntoView(
									{ from: pos, to: pos },
									true,
								);
							},
						}),
					),
				),
			),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.navigation", {
				attributes: { kind: "scroll", line, operation: "navigate" },
			}),
		);
	}

	private readonly applyTransformToEditor = Effect.fn(
		"vam.activeEditor.applyTransform",
	)(function* (snapshot: SourceActiveEditorSnapshot, transform: Transform) {
		const before = snapshot.content;
		const after = yield* Effect.tryPromise({
			catch: (cause) =>
				activeEditorFailure(
					"ReadFailure",
					"processActiveContent.transform",
					getErrorMessage(cause),
					snapshot.path,
					cause,
				),
			try: async () => transform(before),
		});
		if (after === before) return after;
		yield* assertSnapshotCurrent(snapshot, "processActiveContent.write");
		const currentContent = yield* Effect.try({
			catch: (cause) =>
				activeEditorFailure(
					"ReadFailure",
					"processActiveContent.revalidate",
					getErrorMessage(cause),
					snapshot.path,
					cause,
				),
			try: () => snapshot.editor.getValue(),
		});
		if (currentContent !== before) {
			return yield* activeEditorFailure(
				"IdentityMismatch",
				"processActiveContent.revalidate",
				"Editor content changed while the transform was running",
				snapshot.path,
			);
		}
		yield* Effect.try({
			catch: (cause) =>
				activeEditorFailure(
					"WriteFailure",
					"processActiveContent.write",
					getErrorMessage(cause),
					snapshot.path,
					cause,
				),
			try: () => {
				const changes = computeLineChanges(before, after);
				if (changes.length) snapshot.editor.transaction({ changes });
			},
		});
		return after;
	});
}

function annotateSnapshotPath(snapshot: ActiveEditorSnapshot) {
	return Effect.annotateCurrentSpan({ path: snapshot.path });
}
