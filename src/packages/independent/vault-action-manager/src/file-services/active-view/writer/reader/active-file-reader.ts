import { Effect } from "effect";
import type { TFolder } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../../../../types/split-path";
import {
	type ActiveEditorSnapshot,
	acquireActiveEditorSnapshot,
	activeEditorFailure,
	requireSourceMode,
	snapshotMatches,
} from "../../active-editor-snapshot";
import { annotateFileAccessFailure } from "../../tracing";

export class ActiveFileReader {
	snapshot() {
		return acquireActiveEditorSnapshot();
	}

	sourceSnapshot(snapshot?: ActiveEditorSnapshot) {
		return (snapshot ? Effect.succeed(snapshot) : this.snapshot()).pipe(
			Effect.flatMap(requireSourceMode),
		);
	}

	pwd(snapshot?: ActiveEditorSnapshot) {
		return snapshot
			? Effect.succeed(snapshot.splitPath)
			: this.snapshot().pipe(Effect.map((current) => current.splitPath));
	}

	mdPwd() {
		return this.pwd().pipe(
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
		);
	}

	getContent(snapshot?: ActiveEditorSnapshot) {
		return this.sourceSnapshot(snapshot).pipe(
			Effect.tap((current) =>
				Effect.annotateCurrentSpan({ path: current.path }),
			),
			Effect.map((current) => current.content),
			Effect.tapError(annotateFileAccessFailure),
			Effect.withSpan("vam.activeEditor.read", {
				attributes: { operation: "read" },
			}),
		);
	}

	getParent(snapshot?: ActiveEditorSnapshot) {
		return (snapshot ? Effect.succeed(snapshot) : this.snapshot()).pipe(
			Effect.flatMap((current) =>
				current.file.parent
					? Effect.succeed(current.file.parent as TFolder)
					: Effect.fail(
							activeEditorFailure(
								"PathFailure",
								"getActiveFileParent",
								"Active file has no parent",
								current.path,
							),
						),
			),
		);
	}

	getOpenedTFile(snapshot?: ActiveEditorSnapshot) {
		return snapshot
			? Effect.succeed(snapshot.file)
			: this.snapshot().pipe(Effect.map((current) => current.file));
	}

	observeTarget(target: AnySplitPath) {
		return this.snapshot().pipe(
			Effect.map((snapshot) =>
				snapshotMatches(snapshot, target) ? snapshot : null,
			),
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
		);
	}

	isFileActive(splitPath: SplitPathToMdFile) {
		return this.observeTarget(splitPath).pipe(
			Effect.map((snapshot) => snapshot !== null),
		);
	}

	isInActiveView(splitPath: AnySplitPath) {
		return this.observeTarget(splitPath).pipe(
			Effect.map((snapshot) => snapshot !== null),
		);
	}

	getSelection(snapshot?: ActiveEditorSnapshot) {
		return this.sourceSnapshot(snapshot).pipe(
			Effect.map((current) => current.selection),
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
		);
	}
}
