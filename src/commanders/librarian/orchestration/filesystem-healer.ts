import {
	editOrAddMetaInfo,
	extractMetaInfo,
} from "../../../services/dto-services/meta-info-manager/interface";
import {
	type LegacyVaultAction,
	LegacyVaultActionType,
} from "../../../services/obsidian-services/file-services/background/background-vault-actions";
import type { TexfresserObsidianServices } from "../../../services/obsidian-services/interface";
import type { PrettyPathLegacy } from "../../../types/common-interface/dtos";
import { TextStatusLegacy } from "../../../types/common-interface/enums";
import type { ActionDispatcherLegacy } from "../action-dispatcher";
import { isInUntrackedLegacy, type RootNameLegacy } from "../constants";
import { healFileLegacy } from "../filesystem/healing";
import { canonicalizePrettyPathLegacy } from "../invariants/path-canonicalizer";

export class FilesystemHealerLegacy {
	constructor(
		private readonly deps: Pick<
			TexfresserObsidianServices,
			"backgroundFileService"
		> & { dispatcher: ActionDispatcherLegacy },
	) {}

	async healRootFilesystem(rootName: RootNameLegacy): Promise<void> {
		const fileReaders =
			await this.deps.backgroundFileService.getReadersToAllMdFilesInFolder(
				{
					basename: rootName,
					pathParts: [],
					type: "folder",
				},
			);

		const actions: LegacyVaultAction[] = [];
		const seenFolders = new Set<string>();

		// Layer 1: Heal file paths
		for (const reader of fileReaders) {
			const prettyPath: PrettyPathLegacy = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};
			if (isInUntrackedLegacy(prettyPath.pathParts)) continue;
			const healResult = healFileLegacy(
				prettyPath,
				rootName,
				seenFolders,
			);
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
			PrettyPathLegacy & { readContent: () => Promise<string> }
		>,
		rootName: RootNameLegacy,
	): Promise<LegacyVaultAction[]> {
		const actions: LegacyVaultAction[] = [];

		for (const reader of fileReaders) {
			const prettyPath: PrettyPathLegacy = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};
			if (isInUntrackedLegacy(prettyPath.pathParts)) continue;

			const canonical = canonicalizePrettyPathLegacy({
				prettyPath,
				rootName,
			});
			if ("reason" in canonical) continue;

			const kind = canonical.kind;
			if (kind === "codex") continue;

			const content = await reader.readContent();
			const meta = extractMetaInfo(content);
			if (meta === null) {
				if (kind === "scroll") {
					actions.push({
						payload: {
							prettyPath,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Scroll",
									status: TextStatusLegacy.NotStarted,
								}),
						},
						type: LegacyVaultActionType.ProcessFile,
					});
				} else if (kind === "page") {
					const pageStr =
						canonical.treePath[canonical.treePath.length - 1] ??
						"0";
					const idx = Number(pageStr);
					actions.push({
						payload: {
							prettyPath,
							transform: (old) =>
								editOrAddMetaInfo(old, {
									fileType: "Page",
									index: Number.isFinite(idx) ? idx : 0,
									status: TextStatusLegacy.NotStarted,
								}),
						},
						type: LegacyVaultActionType.ProcessFile,
					});
				}
			} else if (kind !== "page" && meta.fileType === "Page") {
				actions.push({
					payload: {
						prettyPath,
						transform: (old) =>
							editOrAddMetaInfo(old, {
								fileType: "Scroll",
								status:
									meta.status ?? TextStatusLegacy.NotStarted,
							}),
					},
					type: LegacyVaultActionType.ProcessFile,
				});
			}
		}

		return actions;
	}

	private cleanupOrphanFolders(
		fileReaders: Array<PrettyPathLegacy>,
		rootName: RootNameLegacy,
	): LegacyVaultAction[] {
		// Build folder contents map
		const folderContents = new Map<
			string,
			{
				hasCodex: boolean;
				hasNote: boolean;
				codexPaths: PrettyPathLegacy[];
			}
		>();

		for (const reader of fileReaders) {
			const prettyPath: PrettyPathLegacy = {
				basename: reader.basename,
				pathParts: reader.pathParts,
			};

			if (isInUntrackedLegacy(prettyPath.pathParts)) continue;

			const canonical = canonicalizePrettyPathLegacy({
				prettyPath,
				rootName,
			});
			const targetPath =
				"reason" in canonical
					? canonical.destination
					: canonical.canonicalPrettyPathLegacy;

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
		const actions: LegacyVaultAction[] = [];

		for (const [folderKey, info] of folderContents.entries()) {
			if (folderKey === rootName) continue;
			if (info.hasNote) continue;

			const parts = folderKey.split("/").filter(Boolean);
			if (parts.length === 0) continue;
			if (isInUntrackedLegacy(parts)) continue;

			const basename = parts[parts.length - 1] ?? "";
			const pathParts = parts.slice(0, -1);

			for (const codexPath of info.codexPaths) {
				actions.push({
					payload: { prettyPath: codexPath },
					type: LegacyVaultActionType.TrashFile,
				});
			}

			actions.push({
				payload: { prettyPath: { basename, pathParts } },
				type: LegacyVaultActionType.TrashFolder,
			});
		}

		return actions;
	}
}
