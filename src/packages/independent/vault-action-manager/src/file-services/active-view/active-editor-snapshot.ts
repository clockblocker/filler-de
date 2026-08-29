import { Effect } from "effect";
import type { EditorPosition, EditorSelection, TFile } from "obsidian";
import {
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamNoActiveEditorError,
} from "../../effect/errors";
import {
	ActiveEditorAccess,
	type ActiveEditorHandle,
	VaultIo,
} from "../../effect/ports";
import { pathfinder } from "../../helpers/pathfinder";
import type { AnySplitPath, SplitPathToMdFile } from "../../types/split-path";
import { annotateFileAccessFailure } from "./tracing";

export type ActiveEditorSnapshot = ActiveEditorHandle & {
	readonly file: TFile;
	readonly path: string;
	readonly splitPath: SplitPathToMdFile;
};

export type SourceActiveEditorSnapshot = ActiveEditorSnapshot & {
	readonly content: string;
	readonly currentLine: string;
	readonly cursor: EditorPosition;
	readonly cursorOffset: number;
	readonly mode: "source";
	readonly primarySelection: EditorSelection | null;
	readonly selection: string | null;
	readonly selectionStartOffset: number | null;
};

export function activeEditorFailure(
	reason: VamActiveEditorFailureReason,
	operation: string,
	message: string,
	path?: string,
	cause?: unknown,
): VamActiveEditorError {
	return new VamActiveEditorError({
		cause:
			cause === undefined
				? new Error(message)
				: new Error(message, { cause }),
		operation,
		path,
		reason,
	});
}

export const acquireActiveEditorSnapshot = Effect.fn(
	"vam.activeEditor.snapshot",
)(function* () {
	yield* Effect.annotateCurrentSpan({ operation: "snapshot" });
	const access = yield* ActiveEditorAccess;
	const handle = yield* access.getActiveEditor;
	if (!handle) {
		return yield* new VamNoActiveEditorError({
			cause: new Error("No active Markdown editor"),
			operation: "acquireActiveEditorSnapshot",
		});
	}
	const snapshot = yield* validateActiveEditorHandle(handle);
	yield* Effect.annotateCurrentSpan({
		mode: snapshot.mode,
		path: snapshot.path,
	});
	return snapshot;
}, Effect.tapError(annotateFileAccessFailure));

export const waitForActiveEditorSnapshot = Effect.fn(
	"vam.activeEditor.snapshot.wait",
)(function* (
	path: string,
	readiness: "editor" | "inline-title",
	expectedInlineTitleText?: string,
) {
	yield* Effect.annotateCurrentSpan({
		operation: "wait",
		path,
		readiness,
	});
	const access = yield* ActiveEditorAccess;
	const handle = yield* access.waitForActiveEditor({
		expectedInlineTitleText,
		path,
		readiness,
	});
	const snapshot = yield* validateActiveEditorHandle(handle);
	if (snapshot.path !== path) {
		return yield* activeEditorFailure(
			"IdentityMismatch",
			"waitForActiveEditorSnapshot",
			`Expected active editor ${path}, got ${snapshot.path}`,
			path,
		);
	}
	return snapshot;
}, Effect.tapError(annotateFileAccessFailure));

export const requireSourceMode = Effect.fn(
	"vam.activeEditor.captureSourceState",
)(function* (snapshot: ActiveEditorSnapshot) {
	if (snapshot.mode !== "source") {
		return yield* activeEditorFailure(
			"WrongMode",
			"requireSourceMode",
			`Active editor is in ${snapshot.mode} mode`,
			snapshot.path,
		);
	}

	yield* assertSnapshotCurrent(snapshot, "captureActiveEditorState.before");
	const captured = yield* Effect.try({
		catch: (cause) =>
			activeEditorFailure(
				"ReadFailure",
				"captureActiveEditorState",
				String(cause),
				snapshot.path,
				cause,
			),
		try: () => {
			const content = snapshot.editor.getValue() ?? "";
			const selection = snapshot.editor.getSelection() || null;
			const primarySelection =
				snapshot.editor.listSelections()[0] ?? null;
			const cursor = snapshot.editor.getCursor();
			const cursorOffset = snapshot.editor.posToOffset(cursor);
			const currentLine = snapshot.editor.getLine(cursor.line);
			const selectionStartOffset = selection
				? snapshot.editor.posToOffset(snapshot.editor.getCursor("from"))
				: null;
			return {
				...snapshot,
				content,
				currentLine,
				cursor,
				cursorOffset,
				mode: "source" as const,
				primarySelection,
				selection,
				selectionStartOffset,
			} satisfies SourceActiveEditorSnapshot;
		},
	});
	yield* assertSnapshotCurrent(captured, "captureActiveEditorState.after");
	return captured;
});

export function snapshotMatches(
	snapshot: ActiveEditorSnapshot,
	target: AnySplitPath,
): boolean {
	return snapshot.path === pathfinder.systemPathFromSplitPath(target);
}

export function assertSnapshotCurrent(
	snapshot: ActiveEditorSnapshot,
	operation: string,
) {
	return Effect.try({
		catch: (cause) =>
			cause instanceof VamActiveEditorError
				? cause
				: activeEditorFailure(
						"AdapterFailure",
						operation,
						String(cause),
						snapshot.path,
						cause,
					),
		try: () => {
			if (!snapshot.isCurrent()) {
				throw activeEditorFailure(
					"IdentityMismatch",
					operation,
					"Editor handle changed after the snapshot was captured",
					snapshot.path,
				);
			}
			return snapshot;
		},
	});
}

const validateActiveEditorHandle = Effect.fn("vam.activeEditor.validateHandle")(
	function* (handle: ActiveEditorHandle) {
		if (!handle.file) {
			return yield* activeEditorFailure(
				"MissingFile",
				"validateActiveEditorHandle",
				"Active Markdown editor has no file",
			);
		}

		const file = handle.file;
		const path = file.path;
		yield* assertActiveEditorHandleCurrent(
			handle,
			path,
			"validateActiveEditorHandle.before",
		);
		const vault = yield* VaultIo;
		const current = yield* vault.getAbstractFileByPath(path);
		if (current !== file) {
			return yield* activeEditorFailure(
				"StaleFile",
				"validateActiveEditorHandle",
				`Active editor file identity is stale: ${path}`,
				path,
			);
		}

		const splitPath = yield* Effect.try({
			catch: (cause) =>
				activeEditorFailure(
					"PathFailure",
					"splitActiveEditorPath",
					String(cause),
					path,
					cause,
				),
			try: () => pathfinder.splitPathFromSystemPath(path),
		});
		if (splitPath.kind !== "MdFile") {
			return yield* activeEditorFailure(
				"PathFailure",
				"splitActiveEditorPath",
				"Active Markdown editor file did not decode as Markdown",
				path,
			);
		}
		yield* assertActiveEditorHandleCurrent(
			handle,
			path,
			"validateActiveEditorHandle.after",
		);

		return {
			...handle,
			file,
			path,
			splitPath,
		} satisfies ActiveEditorSnapshot;
	},
);

function assertActiveEditorHandleCurrent(
	handle: ActiveEditorHandle,
	path: string,
	operation: string,
) {
	return Effect.try({
		catch: (cause) =>
			cause instanceof VamActiveEditorError
				? cause
				: activeEditorFailure(
						"AdapterFailure",
						operation,
						String(cause),
						path,
						cause,
					),
		try: () => {
			if (!handle.isCurrent()) {
				throw activeEditorFailure(
					"IdentityMismatch",
					operation,
					"Active editor changed while its snapshot was being validated",
					path,
				);
			}
		},
	});
}
