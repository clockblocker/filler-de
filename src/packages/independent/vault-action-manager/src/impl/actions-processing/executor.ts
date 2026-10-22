import { Effect, Result } from "effect";
import {
	classifyActionFailure,
	type VamActionOutcome,
} from "../../effect/dispatch-report";
import { VamDispatchError, type VamFileWriteError } from "../../effect/errors";
import { type VamLiveServices, VaultIo } from "../../effect/ports";
import type { TFileHelper } from "../../file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../../file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../../file-services/markdown-file-access";
import {
	type MdFileWithContentDto,
	pathfinder,
} from "../../helpers/pathfinder";
import { vaultContentHash } from "../../internal/content-hash";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";

/**
 * Executes one action and answers what it did to the vault. A failure is a
 * `VamDispatchError` whose `kind` tells whether the action may have changed
 * the vault.
 */
export class Executor {
	constructor(
		private readonly tfileHelper: TFileHelper,
		private readonly tfolderHelper: TFolderHelper,
		private readonly markdownFiles: MarkdownFileAccess,
	) {}

	execute(
		action: VaultAction,
	): Effect.Effect<VamActionOutcome, VamDispatchError, VamLiveServices> {
		return this.executeAction(action).pipe(
			Effect.mapError(
				(cause) =>
					new VamDispatchError({
						action,
						cause,
						kind: classifyActionFailure(cause),
						operation: `execute.${action.kind}`,
					}),
			),
		);
	}

	private executeAction(
		action: VaultAction,
	): Effect.Effect<VamActionOutcome, VamFileWriteError, VamLiveServices> {
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
					const content = action.payload.content ?? "";
					yield* vault.create(
						pathfinder.systemPathFromSplitPath(
							action.payload.splitPath,
						),
						content,
					);
					return {
						_tag: "Created",
						contentHash: vaultContentHash(content),
					} as const;
				});
			case VaultActionKind.UpsertMdFile:
				return Effect.gen({ self: this }, function* () {
					const { splitPath, content } = action.payload;
					const existing = yield* Effect.result(
						this.tfileHelper.getFile(splitPath),
					);
					if (Result.isSuccess(existing)) {
						return content === null || content === undefined
							? ({ _tag: "NoOp" } as const)
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
