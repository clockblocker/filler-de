import { Effect, Result } from "effect";
import { VamDispatchError, type VamFileAccessError } from "../../effect/errors";
import { type VamLiveServices, VaultIo } from "../../effect/ports";
import type { TFileHelper } from "../../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../../file-services/markdown-file-access";
import {
	type MdFileWithContentDto,
	pathfinder,
} from "../../helpers/pathfinder";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";

/** Executes one native action program; compatibility mapping belongs in the facade. */
export class Executor {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly markdownFiles: MarkdownFileAccess,
	) {}

	execute(action: VaultAction) {
		return this.executeAction(action).pipe(
			Effect.mapError(
				(cause) =>
					new VamDispatchError({
						action,
						cause,
						operation: `execute.${action.kind}`,
					}),
			),
		);
	}

	private executeAction(
		action: VaultAction,
	): Effect.Effect<unknown, VamFileAccessError, VamLiveServices> {
		switch (action.kind) {
			case VaultActionKind.CreateFolder:
				return this.tfolderHelper.createFolder(
					action.payload.splitPath,
				);
			case VaultActionKind.RenameFolder:
				return this.tfolderHelper.renameFolder(action.payload);
			case VaultActionKind.TrashFolder:
				return this.tfolderHelper.trashFolder(action.payload.splitPath);
			case VaultActionKind.CreateFile:
				return Effect.gen(function* () {
					const vault = yield* VaultIo;
					return yield* vault.create(
						pathfinder.systemPathFromSplitPath(
							action.payload.splitPath,
						),
						action.payload.content ?? "",
					);
				});
			case VaultActionKind.UpsertMdFile:
				return Effect.gen({ self: this }, function* () {
					const { splitPath, content } = action.payload;
					const existing = yield* Effect.result(
						this.tfileHelper.getFile(splitPath),
					);
					if (Result.isSuccess(existing)) {
						return content === null || content === undefined
							? existing.success
							: yield* this.markdownFiles.replaceContent(
									splitPath,
									content,
								);
					}
					if (existing.failure.operation !== "getFile") {
						return yield* existing.failure;
					}
					const dto: MdFileWithContentDto = {
						content: content ?? "",
						splitPath,
					};
					return yield* this.tfileHelper.upsertMdFile(dto);
				});
			case VaultActionKind.RenameFile:
				return this.markdownFiles.renameFile(action.payload);
			case VaultActionKind.RenameMdFile:
				return this.markdownFiles.renameFile(action.payload);
			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile:
				return this.tfileHelper.trashFile(action.payload.splitPath);
			case VaultActionKind.ProcessMdFile: {
				const payload = action.payload;
				const transform =
					"transform" in payload
						? payload.transform
						: (content: string) =>
								content.replace(payload.before, payload.after);
				return this.markdownFiles.processContent({
					splitPath: payload.splitPath,
					transform,
				});
			}
		}
	}
}
