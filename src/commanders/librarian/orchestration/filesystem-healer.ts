import type {
	CoreSplitPath,
	SplitPathToMdFile,
} from "../../../obsidian-vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionType,
} from "../../../obsidian-vault-action-manager/types/vault-action";
import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../../services/dto-services/meta-info-manager/interface";
import { TextStatus } from "../../../types/common-interface/enums";
import type { LegacyActionDispatcher } from "../action-dispatcher";
import { isInUntracked, type RootName } from "../constants";
import { healFile } from "../filesystem/healing";
import { canonicalizePath } from "../invariants/path-canonicalizer";
import type { ManagerFsAdapter } from "../utils/manager-fs-adapter.ts";

export class FilesystemHealer {
	constructor(
		private readonly deps: {
			backgroundFileService: ManagerFsAdapter;
			dispatcher: LegacyActionDispatcher;
		},
	) {}

	async healRootFilesystem(rootName: RootName): Promise<void> {
		const fileReaders =
			await this.deps.backgroundFileService.getReadersToAllMdFilesInFolder(
				{
					basename: rootName,
					pathParts: [],
					type: "Folder",
				},
			);

		const actions: VaultAction[] = [];
		const seenFolders = new Set<string>();

		// Layer 1: Heal file paths
		for (const reader of fileReaders) {
			if (isInUntracked(reader.pathParts)) continue;
			const healResult = healFile(reader, rootName, seenFolders);
			actions.push(...healResult.actions);
		}

		// Initialize meta-info for files missing it
		const metaActions = await this.initializeMetaInfo(
			fileReaders,
			rootName,
		);
		actions.push(...metaActions);

		// Cleanup orphan folders
		const cleanupActions = this.cleanupOrphanFolders(fileReaders, rootName);
		actions.push(...cleanupActions);

		if (actions.length === 0) return;

		this.deps.dispatcher.registerSelf(actions);
		this.deps.dispatcher.pushMany(actions);
		await this.deps.dispatcher.flushNow();
	}

	private async initializeMetaInfo(
		fileReaders: Array<
			SplitPathToMdFile & { readContent: () => Promise<string> }
		>,
		rootName: RootName,
	): Promise<VaultAction[]> {
		const actions: VaultAction[] = [];

		for (const reader of fileReaders) {
			if (isInUntracked(reader.pathParts)) continue;

			const canonical = canonicalizePath({ path: reader, rootName });
			if ("reason" in canonical) continue;

			const kind = canonical.kind;
			if (kind === "codex") continue;

			const content = await reader.readContent();
			const meta = extractMetaInfo(content);
			if (meta === null) {
				if (kind === "scroll") {
					actions.push({
						payload: {
							coreSplitPath: reader,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Scroll",
									status: TextStatus.NotStarted,
								}),
						},
						type: VaultActionType.ProcessMdFile,
					});
				} else if (kind === "page") {
					const pageStr =
						canonical.treePath[canonical.treePath.length - 1] ??
						"0";
					const idx = Number(pageStr);
					actions.push({
						payload: {
							coreSplitPath: reader,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Page",
									index: Number.isFinite(idx) ? idx : 0,
									status: TextStatus.NotStarted,
								}),
						},
						type: VaultActionType.ProcessMdFile,
					});
				}
			} else if (kind !== "page" && meta.fileType === "Page") {
				actions.push({
					payload: {
						coreSplitPath: reader,
						transform: (old) =>
							editOrAddMetaInfo(old, {
								fileType: "Scroll",
								status: meta.status ?? TextStatus.NotStarted,
							}),
					},
					type: VaultActionType.ProcessMdFile,
				});
			}
		}

		return actions;
	}

	private cleanupOrphanFolders(
		fileReaders: Array<SplitPathToMdFile>,
		rootName: RootName,
	): VaultAction[] {
		// Build folder contents map
		const folderContents = new Map<
			string,
			{ hasCodex: boolean; hasNote: boolean; codexPaths: CoreSplitPath[] }
		>();

		for (const reader of fileReaders) {
			if (isInUntracked(reader.pathParts)) continue;

			const canonical = canonicalizePath({ path: reader, rootName });
			const targetPath =
				"reason" in canonical
					? canonical.destination
					: canonical.canonicalPath;

			const folderKey = targetPath.pathParts.join("/");
			const entry = folderContents.get(folderKey) ?? {
				codexPaths: [],
				hasCodex: false,
				hasNote: false,
			};

			const isCodex = targetPath.basename.startsWith("__");
			if (isCodex) {
				entry.hasCodex = true;
				entry.codexPaths.push(targetPath);
			} else {
				entry.hasNote = true;
			}
			folderContents.set(folderKey, entry);
		}

		// Propagate note presence to ancestor folders
		for (const [folderKey, info] of folderContents.entries()) {
			if (!info.hasNote) continue;
			const parts = folderKey.split("/").filter(Boolean);
			for (let i = 1; i <= parts.length; i++) {
				const ancestorKey = parts.slice(0, i).join("/");
				const ancestorEntry = folderContents.get(ancestorKey) ?? {
					codexPaths: [],
					hasCodex: false,
					hasNote: false,
				};
				ancestorEntry.hasNote = true;
				folderContents.set(ancestorKey, ancestorEntry);
			}
		}

		// Generate cleanup actions
		const actions: VaultAction[] = [];

		for (const [folderKey, info] of folderContents.entries()) {
			if (folderKey === rootName) continue;
			if (info.hasNote) continue;

			const parts = folderKey.split("/").filter(Boolean);
			if (parts.length === 0) continue;
			if (isInUntracked(parts)) continue;

			const basename = parts[parts.length - 1] ?? "";
			const pathParts = parts.slice(0, -1);

			for (const codexPath of info.codexPaths) {
				actions.push({
					payload: { coreSplitPath: codexPath },
					type: VaultActionType.TrashMdFile,
				});
			}

			actions.push({
				payload: { coreSplitPath: { basename, pathParts } },
				type: VaultActionType.TrashFolder,
			});
		}

		return actions;
	}
}
