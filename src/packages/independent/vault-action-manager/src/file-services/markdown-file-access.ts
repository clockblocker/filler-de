import { Effect, Result } from "effect";
import { VaultIo } from "../effect/ports";
import type {
	AnySplitPath,
	SplitPathFromTo,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../types/split-path";
import type { Transform } from "../types/vault-action";
import type { ActiveFileService } from "./active-view/active-file-service";
import { SelectionService } from "./active-view/selection-service";
import type { TFileHelper } from "./background/helpers/tfile-helper";

/** Owns the active-editor/background-vault routing policy for Markdown files. */
export class MarkdownFileAccess {
	private readonly selection: SelectionService;

	constructor(
		private readonly activeEditor: ActiveFileService,
		private readonly backgroundVault: TFileHelper,
	) {
		this.selection = new SelectionService(activeEditor);
	}

	readContent(target: SplitPathToMdFile) {
		return Effect.gen({ self: this }, function* () {
			if (yield* this.isActive(target)) {
				return yield* this.activeEditor.getContent();
			}

			const immediate = yield* Effect.result(
				this.backgroundVault.getFile(target),
			);
			const file = Result.isSuccess(immediate)
				? immediate.success
				: immediate.failure.operation === "getFile"
					? yield* this.backgroundVault.getFileWithRetry(target)
					: yield* immediate.failure;
			const vault = yield* VaultIo;
			return yield* vault.read(file);
		});
	}

	replaceContent(target: SplitPathToMdFile, content: string) {
		return Effect.gen({ self: this }, function* () {
			const active = yield* this.isActive(target);
			return active
				? yield* this.activeEditor.replaceAllContentInActiveFile(
						content,
					)
				: yield* this.backgroundVault.replaceAllContent(
						target,
						content,
					);
		});
	}

	processContent(args: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}) {
		return Effect.gen({ self: this }, function* () {
			const active = yield* this.isActive(args.splitPath);
			return active
				? yield* this.activeEditor.processContent(args)
				: yield* this.backgroundVault.processContent(args);
		});
	}

	renameFile<SPF extends SplitPathToAnyFile>(paths: SplitPathFromTo<SPF>) {
		return Effect.gen({ self: this }, function* () {
			const savedSelection =
				yield* this.activeEditor.saveInlineTitleSelection();
			const renamed = yield* this.backgroundVault.renameFile(paths);
			if (savedSelection) {
				yield* Effect.sleep(50);
				yield* this.activeEditor
					.restoreInlineTitleSelection(savedSelection)
					.pipe(Effect.ignore);
			}
			return renamed;
		});
	}

	isActive(target: AnySplitPath) {
		return this.activeEditor.isInActiveView(target);
	}

	activeMdPath() {
		return this.activeEditor.mdPwd();
	}

	openedContent() {
		return this.activeEditor.getContent();
	}

	selectionInfo() {
		return this.selection.getInfo();
	}

	selectionText() {
		return this.activeEditor.getSelection();
	}

	open(target: SplitPathToMdFile) {
		return this.activeEditor.cd(target).pipe(Effect.asVoid);
	}

	scrollOpenedFileToLine(line: number) {
		return this.activeEditor.scrollToLine(line);
	}
}
