import { Effect } from "effect";
import type { MarkdownView, TFile, TFolder } from "obsidian";
import { VamVaultIoError } from "../../../../effect/errors";
import { ActiveEditorAccess, VaultIo } from "../../../../effect/ports";
import {
	errorFileStale,
	errorGetEditor,
	errorNoActiveView,
	errorNoFileParent,
	errorNotInSourceMode,
} from "../../../../errors";
import { pathfinder } from "../../../../helpers/pathfinder";
import type {
	AnySplitPath,
	SplitPathToMdFile,
} from "../../../../types/split-path";


function activeEditorFailure(
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

export class ActiveFileReader {
	pwd() {
		return this.getOpenedTFile().pipe(
			Effect.flatMap((file) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"splitActiveFilePath",
							String(cause),
							file.path,
							cause,
						),
					try: () => pathfinder.splitPathFromAbstract(file),
				}),
			),
		);
	}

	getContent() {
		return this.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"readActiveEditor",
							String(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.getValue() ?? "",
				}),
			),
		);
	}

	getParent() {
		return this.getOpenedTFile().pipe(
			Effect.flatMap((file) =>
				file.parent
					? Effect.succeed(file.parent as TFolder)
					: Effect.fail(
							activeEditorFailure(
								"getActiveFileParent",
								errorNoFileParent(),
								file.path,
							),
						),
			),
		);
	}

	getOpenedTFile() {
		return this.getActiveView().pipe(
			Effect.flatMap((view) =>
				view.file
					? this.validateFileInVault(view.file)
					: Effect.fail(
							activeEditorFailure(
								"getOpenedTFile",
								errorNoActiveView(),
							),
						),
			),
		);
	}

	getEditor() {
		return this.getActiveView().pipe(
			Effect.flatMap((view) => this.validateFileExists(view)),
			Effect.flatMap((view) => this.validateSourceMode(view)),
			Effect.map((view) => ({ editor: view.editor, view })),
		);
	}

	getEditorAnyMode() {
		return this.getActiveView().pipe(
			Effect.flatMap((view) =>
				view.file
					? Effect.succeed({ editor: view.editor, view })
					: Effect.fail(
							activeEditorFailure(
								"getEditorAnyMode",
								errorGetEditor(),
							),
						),
			),
		);
	}

	isFileActive(splitPath: SplitPathToMdFile) {
		return this.pwd().pipe(
			Effect.map(
				(pwd) =>
					pwd.pathParts.length === splitPath.pathParts.length &&
					pwd.pathParts.every(
						(part, index) => part === splitPath.pathParts[index],
					) &&
					pwd.basename === splitPath.basename,
			),
		);
	}

	isInActiveView(splitPath: AnySplitPath) {
		if (splitPath.kind !== "MdFile") return Effect.succeed(false);
		return this.isFileActive(splitPath).pipe(
			Effect.orElseSucceed(() => false),
		);
	}

	getSelection() {
		return this.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"getSelection",
							String(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.getSelection() || null,
				}),
			),
		);
	}

	getCursorOffset() {
		return this.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"getCursorOffset",
							String(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.posToOffset(editor.getCursor()),
				}),
			),
		);
	}

	getSelectionStartOffset() {
		return this.getEditor().pipe(
			Effect.flatMap(({ editor, view }) =>
				Effect.try({
					catch: (cause) =>
						activeEditorFailure(
							"getSelectionStartOffset",
							String(cause),
							view.file?.path,
							cause,
						),
					try: () => editor.posToOffset(editor.getCursor("from")),
				}),
			),
		);
	}

	private getActiveView() {
		return Effect.gen(function* () {
			const activeEditor = yield* ActiveEditorAccess;
			const view = yield* activeEditor.getActiveMarkdownView;
			return view
				? view
				: yield* activeEditorFailure(
						"getActiveMarkdownView",
						errorNoActiveView(),
					);
		});
	}

	private validateFileExists(view: MarkdownView) {
		if (!view.file) {
			return Effect.fail(
				activeEditorFailure("validateActiveFile", errorGetEditor()),
			);
		}
		const path = view.file.path;
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			const fileInVault = yield* vault.getAbstractFileByPath(path);
			return fileInVault
				? view
				: yield* activeEditorFailure(
						"validateActiveFile",
						errorGetEditor(errorFileStale(path)),
						path,
					);
		});
	}

	private validateSourceMode(view: MarkdownView) {
		return Effect.try({
			catch: (cause) =>
				activeEditorFailure(
					"validateSourceMode",
					String(cause),
					view.file?.path,
					cause,
				),
			try: () => {
				if (view.getMode() !== "source") {
					throw new Error(errorGetEditor(errorNotInSourceMode()));
				}
				return view;
			},
		});
	}

	private validateFileInVault(file: TFile) {
		return Effect.gen(function* () {
			const vault = yield* VaultIo;
			const fileInVault = yield* vault.getAbstractFileByPath(file.path);
			return fileInVault
				? file
				: yield* activeEditorFailure(
						"validateOpenedFile",
						errorFileStale(file.path),
						file.path,
					);
		});
	}
}
