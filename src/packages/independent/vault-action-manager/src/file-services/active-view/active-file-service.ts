import { Effect } from "effect";
import type { TFile } from "obsidian";
import type {
	AnySplitPath,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../../types/split-path";
import type { Transform } from "../../types/vault-action";
import { cd } from "./navigation/cd";
import {
	ActiveFileWriter,
	type SavedInlineTitleSelection,
	type SavedSelection,
} from "./writer/active-file-writer";
import { ActiveFileReader } from "./writer/reader/active-file-reader";

/** Effect-native active editor service. Programs require ActiveEditorAccess/VaultIo. */
export class ActiveFileService {
	private readonly reader = new ActiveFileReader();
	private readonly writer = new ActiveFileWriter(this.reader);

	pwd() {
		return this.reader.pwd();
	}

	mdPwd() {
		return this.reader.pwd().pipe(
			Effect.map((path) => (path.kind === "MdFile" ? path : null)),
			Effect.orElseSucceed(() => null),
		);
	}

	getOpenedTFile() {
		return this.reader.getOpenedTFile();
	}

	getContent() {
		return this.reader.getContent();
	}

	isFileActive(splitPath: SplitPathToMdFile) {
		return this.reader.isFileActive(splitPath);
	}

	isInActiveView(splitPath: AnySplitPath) {
		return this.reader.isInActiveView(splitPath);
	}

	getSelection() {
		return this.reader
			.getSelection()
			.pipe(Effect.orElseSucceed(() => null));
	}

	getCursorOffset() {
		return this.reader
			.getCursorOffset()
			.pipe(Effect.orElseSucceed(() => null));
	}

	getSelectionStartOffset() {
		return this.reader
			.getSelectionStartOffset()
			.pipe(Effect.orElseSucceed(() => null));
	}

	replaceAllContentInActiveFile(content: string) {
		return this.writer.replaceAllContentInActiveFile(content);
	}

	saveSelection() {
		return this.writer.saveSelection();
	}

	restoreSelection(saved: SavedSelection) {
		return this.writer.restoreSelection(saved);
	}

	saveInlineTitleSelection() {
		return this.writer.saveInlineTitleSelection();
	}

	restoreInlineTitleSelection(saved: SavedInlineTitleSelection) {
		return this.writer.restoreInlineTitleSelection(saved);
	}

	replaceSelection(text: string) {
		return this.writer.replaceSelection(text);
	}

	insertBelowCursor(text: string) {
		return this.writer.insertBelowCursor(text);
	}

	processContent(args: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}) {
		return this.writer.processContent(args);
	}

	scrollToLine(line: number) {
		return this.writer.scrollToLine(line);
	}

	cd(file: TFile | SplitPathToAnyFile) {
		return cd(file);
	}
}
