import { Effect, Result } from "effect";
import {
	VamActiveEditorError,
	VamContentConflictError,
	type VamFileAccessError,
	VamNoActiveEditorError,
	VamVaultIoError,
} from "../effect/errors";
import { VaultIo } from "../effect/ports";
import { pathfinder } from "../helpers/pathfinder";
import {
	ContentPreconditionFailed,
	contentMatches,
} from "../internal/content-precondition";
import type {
	AnySplitPath,
	SplitPathFromTo,
	SplitPathToAnyFile,
	SplitPathToMdFile,
} from "../types/split-path";
import type {
	ExpectedContent,
	RenameCollision,
	Transform,
} from "../types/vault-action";
import type { ActiveFileService } from "./active-view/active-file-service";
import { annotateFileAccessFailure } from "./active-view/tracing";
import type { TFileHelper } from "./background/helpers/tfile-helper";
import { resolveContentRoute } from "./content-route";

/**
 * Owns the routing policy for Markdown files between editors and the
 * background vault. Content reads and writes share one route,
 * `resolveContentRoute`, so a guarded write checks the content a read
 * returned.
 */
export class MarkdownFileAccess {
	constructor(
		private readonly activeEditor: ActiveFileService,
		private readonly backgroundVault: TFileHelper,
	) {}

	/**
	 * The file's content as VAM routes it (`resolveContentRoute`): the
	 * active editor's buffer in source mode, another view's unsaved buffer
	 * (an active view in reading mode counts as another), or the file on
	 * disk. Views with different unsaved content fail it with
	 * `VamContentConflictError`.
	 */
	readonly readContent = Effect.fn("vam.markdown.read")(function* (
		this: MarkdownFileAccess,
		target: SplitPathToMdFile,
	) {
		const path = pathfinder.systemPathFromSplitPath(target);
		yield* Effect.annotateCurrentSpan({ operation: "read", path });
		const route = yield* this.route(target);
		if (route.content !== null) return route.content;
		return route._tag === "Editor"
			? yield* this.activeEditor.getContent(route.snapshot)
			: yield* this.diskContent(target);
	}, Effect.tapError(annotateFileAccessFailure));

	/**
	 * Reads content through the same route as `readContent`, with the file's
	 * stat taken first. A concurrent write can make the content newer than the
	 * stat, never older, so a `(path, mtime)` cache only rereads too often.
	 * An editor may hold unsaved content; its stat describes disk.
	 */
	readonly readContentWithStat = Effect.fn("vam.markdown.readWithStat")(
		function* (this: MarkdownFileAccess, target: SplitPathToMdFile) {
			const path = pathfinder.systemPathFromSplitPath(target);
			yield* Effect.annotateCurrentSpan({ operation: "read", path });
			const vault = yield* VaultIo;
			const file = yield* this.backgroundFile(target);
			const stat = yield* vault.stat(file);
			const route = yield* resolveContentRoute(
				this.activeEditor,
				target,
				Effect.suspend(() => vault.read(file)),
			);
			if (route.content !== null) return { content: route.content, stat };
			const content =
				route._tag === "Editor"
					? yield* this.activeEditor.getContent(route.snapshot)
					: yield* vault.read(file);
			return { content, stat };
		},
		Effect.tapError(annotateFileAccessFailure),
	);

	/** The file's stat on disk, as `readContentWithStat` takes it, without its content. */
	readonly readStat = Effect.fn("vam.markdown.stat")(function* (
		this: MarkdownFileAccess,
		target: SplitPathToMdFile,
	) {
		const path = pathfinder.systemPathFromSplitPath(target);
		yield* Effect.annotateCurrentSpan({ operation: "stat", path });
		const vault = yield* VaultIo;
		const file = yield* this.backgroundFile(target);
		return yield* vault.stat(file);
	}, Effect.tapError(annotateFileAccessFailure));

	readonly replaceContent = Effect.fn("vam.markdown.replace")(function* (
		this: MarkdownFileAccess,
		target: SplitPathToMdFile,
		content: string,
	) {
		const path = pathfinder.systemPathFromSplitPath(target);
		yield* Effect.annotateCurrentSpan({ operation: "replace", path });
		const route = yield* this.route(target);
		return route._tag === "Editor"
			? yield* this.activeEditor.replaceAllContentInActiveFile(
					content,
					route.snapshot,
				)
			: yield* this.backgroundVault.replaceAllContent(target, content);
	}, Effect.tapError(annotateFileAccessFailure));

	readonly processContent = Effect.fn("vam.markdown.transform")(function* (
		this: MarkdownFileAccess,
		args: {
			splitPath: SplitPathToMdFile;
			transform: Transform;
		},
	) {
		const path = pathfinder.systemPathFromSplitPath(args.splitPath);
		yield* Effect.annotateCurrentSpan({ operation: "transform", path });
		const route = yield* this.route(args.splitPath);
		return route._tag === "Editor"
			? yield* this.activeEditor.processContent(args, route.snapshot)
			: yield* this.backgroundVault.processContent(args);
	}, Effect.tapError(annotateFileAccessFailure));

	/**
	 * Trashes the file; `NoOp` when it is gone. With `ifContent`, only while
	 * it holds that content, as `readContent` routes it: an open view's
	 * buffer, unsaved typing included, or the file on disk. The check runs
	 * immediately before the trash; otherwise, or when background views
	 * hold different unsaved typing, it fails with `VamContentConflictError`
	 * and trashes nothing.
	 */
	readonly trashFile = Effect.fn("vam.markdown.trash")(function* (
		this: MarkdownFileAccess,
		target: SplitPathToMdFile,
		ifContent?: ExpectedContent,
	) {
		const path = pathfinder.systemPathFromSplitPath(target);
		yield* Effect.annotateCurrentSpan({ operation: "trash", path });
		if (ifContent !== undefined) {
			const present = yield* Effect.result(
				this.backgroundVault.getFile(target),
			);
			if (Result.isFailure(present)) {
				if (present.failure.operation !== "getFile")
					return yield* present.failure;
				return { _tag: "NoOp" } as const;
			}
			const current = yield* this.readContent(target);
			if (!contentMatches(current, ifContent))
				return yield* new VamContentConflictError({
					cause: new ContentPreconditionFailed({
						expected: ifContent,
					}),
					operation: "trashFile.ifContent",
					path,
				});
		}
		return yield* this.backgroundVault.trashFile(target);
	}, Effect.tapError(annotateFileAccessFailure));

	readonly renameFile = Effect.fn("vam.markdown.rename")(function* <
		SPF extends SplitPathToAnyFile,
	>(
		this: MarkdownFileAccess,
		paths: SplitPathFromTo<SPF> & {
			readonly onCollision?: RenameCollision;
			readonly updateLinks?: boolean;
		},
	) {
		const fromPath = pathfinder.systemPathFromSplitPath(paths.from);
		const toPath = pathfinder.systemPathFromSplitPath(paths.to);
		yield* Effect.annotateCurrentSpan({
			from: fromPath,
			operation: "rename",
			path: toPath,
		});
		const active = yield* this.activeEditor.observeTarget(paths.from);
		const savedSelection = active
			? yield* this.activeEditor.saveInlineTitleSelection(active)
			: null;
		const { file: renamed, outcome } =
			yield* this.backgroundVault.renameFile(paths);
		yield* Effect.annotateCurrentSpan({ path: renamed.path });
		if (savedSelection && active && renamed === active.file) {
			yield* this.activeEditor
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
		return outcome;
	}, Effect.tapError(annotateFileAccessFailure));

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

	private route(target: SplitPathToMdFile) {
		return resolveContentRoute(
			this.activeEditor,
			target,
			this.diskContent(target),
		);
	}

	private diskContent(target: SplitPathToMdFile) {
		const self = this;
		return Effect.gen(function* () {
			const file = yield* self.backgroundFile(target);
			const vault = yield* VaultIo;
			return yield* vault.read(file);
		});
	}

	private backgroundFile(target: SplitPathToMdFile) {
		const self = this;
		return Effect.gen(function* () {
			const immediate = yield* Effect.result(
				self.backgroundVault.getFile(target),
			);
			return Result.isSuccess(immediate)
				? immediate.success
				: immediate.failure.operation === "getFile"
					? yield* self.backgroundVault.getFileWithRetry(target)
					: yield* immediate.failure;
		});
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
