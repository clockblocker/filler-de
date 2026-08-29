import { Effect, Result } from "effect";
import {
	VamActiveEditorError,
	type VamFileAccessError,
	VamNoActiveEditorError,
	VamVaultIoError,
} from "../effect/errors";
import { VaultIo } from "../effect/ports";
import { pathfinder } from "../helpers/pathfinder";
import type {
	AnySplitPath,
	SplitPathFromTo,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../types/split-path";
import type { Transform } from "../types/vault-action";
import type { ActiveFileService } from "./active-view/active-file-service";
import { annotateFileAccessFailure } from "./active-view/tracing";
import type { TFileHelper } from "./background/helpers/tfile-helper";

/** Owns the active-editor/background-vault routing policy for Markdown files. */
export class MarkdownFileAccess {
	constructor(
		private readonly activeEditor: ActiveFileService,
		private readonly backgroundVault: TFileHelper,
	) {}

	readContent(target: SplitPathToMdFile) {
		const path = pathfinder.systemPathFromSplitPath(target);
		const self = this;
		return Effect.fn("vam.markdown.read")(function* () {
			yield* Effect.annotateCurrentSpan({ operation: "read", path });
			const active = yield* self.activeEditor.observeTarget(target);
			if (active) {
				return yield* self.activeEditor.getContent(active);
			}

			const immediate = yield* Effect.result(
				self.backgroundVault.getFile(target),
			);
			const file = Result.isSuccess(immediate)
				? immediate.success
				: immediate.failure.operation === "getFile"
					? yield* self.backgroundVault.getFileWithRetry(target)
					: yield* immediate.failure;
			const vault = yield* VaultIo;
			return yield* vault.read(file);
		}, Effect.tapError(annotateFileAccessFailure))();
	}

	replaceContent(target: SplitPathToMdFile, content: string) {
		const path = pathfinder.systemPathFromSplitPath(target);
		const self = this;
		return Effect.fn("vam.markdown.replace")(function* () {
			yield* Effect.annotateCurrentSpan({ operation: "replace", path });
			const active = yield* self.activeEditor.observeTarget(target);
			return active
				? yield* self.activeEditor.replaceAllContentInActiveFile(
						content,
						active,
					)
				: yield* self.backgroundVault.replaceAllContent(
						target,
						content,
					);
		}, Effect.tapError(annotateFileAccessFailure))();
	}

	processContent(args: {
		splitPath: SplitPathToMdFile;
		transform: Transform;
	}) {
		const path = pathfinder.systemPathFromSplitPath(args.splitPath);
		const self = this;
		return Effect.fn("vam.markdown.transform")(function* () {
			yield* Effect.annotateCurrentSpan({ operation: "transform", path });
			const active = yield* self.activeEditor.observeTarget(
				args.splitPath,
			);
			return active
				? yield* self.activeEditor.processContent(args, active)
				: yield* self.backgroundVault.processContent(args);
		}, Effect.tapError(annotateFileAccessFailure))();
	}

	renameFile<SPF extends SplitPathToAnyFile>(paths: SplitPathFromTo<SPF>) {
		const fromPath = pathfinder.systemPathFromSplitPath(paths.from);
		const toPath = pathfinder.systemPathFromSplitPath(paths.to);
		const self = this;
		return Effect.fn("vam.markdown.rename")(function* () {
			yield* Effect.annotateCurrentSpan({
				from: fromPath,
				operation: "rename",
				path: toPath,
			});
			const active = yield* self.activeEditor.observeTarget(paths.from);
			const savedSelection = active
				? yield* self.activeEditor.saveInlineTitleSelection(active)
				: null;
			const renamed = yield* self.backgroundVault.renameFile(paths);
			yield* Effect.annotateCurrentSpan({ path: renamed.path });
			if (savedSelection && active && renamed === active.file) {
				yield* self.activeEditor
					.restoreInlineTitleSelectionAfterRename(
						savedSelection,
						renamed.path,
						renamed.basename,
					)
					.pipe(
						Effect.mapError(markPostRenameFailure),
						Effect.uninterruptible,
					);
			}
			return renamed;
		}, Effect.tapError(annotateFileAccessFailure))();
	}

	isActive(target: AnySplitPath) {
		return this.activeEditor
			.observeTarget(target)
			.pipe(Effect.map((snapshot) => snapshot !== null));
	}

	activeMdPath() {
		return this.activeEditor.mdPwd();
	}

	activeContext() {
		return this.activeEditor.context();
	}

	openedContent() {
		return this.activeEditor.getContent();
	}

	selectionInfo() {
		return this.activeEditor.selectionInfo();
	}

	selectionText() {
		return this.activeEditor.getSelection();
	}

	replaceOpenedLine(args: {
		readonly after: string;
		readonly before: string;
		readonly line: number;
		readonly splitPath: SplitPathToMdFile;
	}) {
		return this.activeEditor.replaceLine(args);
	}

	open(target: SplitPathToMdFile) {
		return this.activeEditor.cd(target).pipe(Effect.asVoid);
	}

	scrollOpenedFileToLine(line: number) {
		return this.activeEditor.scrollToLine(line);
	}
}

function markPostRenameFailure(error: VamFileAccessError): VamFileAccessError {
	if (error._tag === "VamActiveEditorError") {
		return new VamActiveEditorError({
			cause: error,
			operation: "renameFile.restoreSelection",
			path: error.path,
			reason: error.reason,
			stateChanged: true,
		});
	}
	if (error._tag === "VamNoActiveEditorError") {
		return new VamNoActiveEditorError({
			cause: error,
			operation: "renameFile.restoreSelection",
			stateChanged: true,
		});
	}
	return new VamVaultIoError({
		cause: error,
		operation: "renameFile.restoreSelection",
		path: error.path,
		stateChanged: true,
	});
}
