import { Effect } from "effect";
import type { EditorPosition, TFile } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import {
	type ActiveEditorSnapshot,
	waitForActiveEditorSnapshot,
} from "./active-editor-snapshot";
import { cd } from "./navigation/cd";
import { type SelectionInfo, SelectionService } from "./selection-service";
import {
	ActiveFileWriter,
	type SavedInlineTitleSelection,
	type SavedSelection,
} from "./writer/active-file-writer";
import { ActiveFileReader } from "./writer/reader/active-file-reader";

/** Effect-native active editor service. Programs require ActiveEditorAccess/VaultIo. */
export type ActiveEditorContext = {
	readonly content: string;
	readonly currentLine: string;
	readonly cursor: EditorPosition;
	readonly selection: SelectionInfo;
	readonly splitPath: SplitPathToMdFile;
};

export class ActiveFileService {
	private readonly reader = new ActiveFileReader();
	private readonly writer = new ActiveFileWriter(this.reader);
	private readonly selection = new SelectionService(this.reader);

	pwd() {
		return this.reader.pwd();
	}

	mdPwd() {
		return this.reader.mdPwd();
	}

	getOpenedTFile() {
		return this.reader.getOpenedTFile();
	}

	getContent(snapshot?: ActiveEditorSnapshot) {
		return this.reader.getContent(snapshot);
	}

	observeTarget(splitPath: AnySplitPath) {
		return this.reader.observeTarget(splitPath);
	}

	isFileActive(splitPath: SplitPathToMdFile) {
		return this.reader.isFileActive(splitPath);
	}

	isInActiveView(splitPath: AnySplitPath) {
		return this.reader.isInActiveView(splitPath);
	}

	getSelection() {
		return this.reader.getSelection();
	}

	selectionInfo(snapshot?: ActiveEditorSnapshot) {
		return this.selection.getInfo(snapshot);
	}

	context() {
		return this.reader.sourceSnapshot().pipe(
			Effect.tap((snapshot) =>
				Effect.annotateCurrentSpan({ path: snapshot.path }),
			),
			Effect.map(
				(snapshot) =>
					({
						content: snapshot.content,
						currentLine: snapshot.currentLine,
						cursor: snapshot.cursor,
						selection: this.selection.fromSnapshot(snapshot),
						splitPath: snapshot.splitPath,
					}) satisfies ActiveEditorContext,
			),
			Effect.catchTag("VamNoActiveEditorError", () =>
				Effect.succeed(null),
			),
			Effect.withSpan("vam.activeEditor.context", {
				attributes: { operation: "read-context" },
			}),
		);
	}

	replaceAllContentInActiveFile(
		content: string,
		snapshot?: ActiveEditorSnapshot,
	) {
		return this.writer.replaceAllContentInActiveFile(content, snapshot);
	}

	saveSelection() {
		return this.writer.saveSelection();
	}

	restoreSelection(saved: SavedSelection) {
		return this.writer.restoreSelection(saved);
	}

	saveInlineTitleSelection(snapshot?: ActiveEditorSnapshot) {
		return this.writer.saveInlineTitleSelection(snapshot);
	}

	restoreInlineTitleSelection(saved: SavedInlineTitleSelection) {
		return this.writer.restoreInlineTitleSelection(saved);
	}

	restoreInlineTitleSelectionAfterRename(
		saved: SavedInlineTitleSelection,
		path: string,
		expectedInlineTitleText: string,
	) {
		return waitForActiveEditorSnapshot(
			path,
			"inline-title",
			expectedInlineTitleText,
		).pipe(
			Effect.flatMap((snapshot) =>
				this.writer.restoreInlineTitleSelection(saved, snapshot),
			),
		);
	}

	replaceSelection(text: string) {
		return this.writer.replaceSelection(text);
	}

	insertBelowCursor(text: string) {
		return this.writer.insertBelowCursor(text);
	}

	replaceLine(args: {
		readonly after: string;
		readonly before: string;
		readonly line: number;
		readonly splitPath: SplitPathToMdFile;
	}) {
		return this.writer.replaceLine(args);
	}

	processContent(
		args: {
			splitPath: SplitPathToMdFile;
			transform: Transform;
		},
		snapshot?: ActiveEditorSnapshot,
	) {
		return this.writer.processContent(args, snapshot);
	}

	scrollToLine(line: number) {
		return this.writer.scrollToLine(line);
	}

	cd(file: TFile | SplitPathToAnyFile) {
		return cd(file);
	}
}
