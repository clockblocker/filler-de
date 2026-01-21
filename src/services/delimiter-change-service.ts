import type { App, TFile } from "obsidian";
import type { Librarian } from "../commanders/librarian/librarian";
import type { VaultActionManager } from "../managers/obsidian/vault-action-manager";
import { makeSplitPath } from "../managers/obsidian/vault-action-manager/impl/common/split-path-and-system-path";
import type { SplitPathToMdFile } from "../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../managers/obsidian/vault-action-manager/types/vault-action";
import type { SuffixDelimiterConfig } from "../types";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../utils/delimiter";
import { logger } from "../utils/logger";

export interface DelimiterChangeResult {
	success: boolean;
	renamedCount: number;
	errors: string[];
}

/**
 * Service for safely changing the suffix delimiter across all library files.
 * Routes renames through VaultActionManager with chunked batches and proper event synchronization.
 */
export class DelimiterChangeService {
	constructor(
		private readonly app: App,
		private readonly vaultActionManager: VaultActionManager,
	) {}

	/**
	 * Change the suffix delimiter for all files in the library.
	 *
	 * @param oldConfig - Previous delimiter configuration
	 * @param newConfig - New delimiter configuration
	 * @param libraryRoot - Path to the library root folder
	 * @param librarian - Current Librarian instance to pause during rename
	 * @returns Result with success status, count of renamed files, and any errors
	 */
	async changeDelimiter(
		oldConfig: SuffixDelimiterConfig,
		newConfig: SuffixDelimiterConfig,
		libraryRoot: string,
		librarian: Librarian,
	): Promise<DelimiterChangeResult> {
		const oldDelim = buildCanonicalDelimiter(oldConfig);
		const newDelim = buildCanonicalDelimiter(newConfig);

		if (oldDelim === newDelim) {
			return { errors: [], renamedCount: 0, success: true };
		}

		// Collect files to rename
		const mdFiles = this.collectMdFilesInLibrary(libraryRoot);
		const actions = this.buildRenameActions(mdFiles, oldConfig, newConfig);

		if (actions.length === 0) {
			return { errors: [], renamedCount: 0, success: true };
		}

		// 1. Pause librarian (unsubscribe from events)
		await librarian.unsubscribe();

		// 2. Dispatch in chunks of 50
		const errors: string[] = [];
		const chunkSize = 50;
		const chunks = this.chunkArray(actions, chunkSize);

		for (const [i, chunk] of chunks.entries()) {
			logger.debug(
				`[DelimiterChangeService] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} files)`,
			);

			const result = await this.vaultActionManager.dispatch(chunk);
			if (result.isErr()) {
				errors.push(
					...result.error.map((e) => `${e.action.kind}: ${e.error}`),
				);
			}

			// Wait for Obsidian to process all events from this chunk
			await this.vaultActionManager.waitForObsidianEvents();
		}

		const renamedCount = actions.length - errors.length;

		if (errors.length > 0) {
			logger.error(
				`[DelimiterChangeService] Completed with ${errors.length} errors:`,
				errors.slice(0, 5).join(", "),
			);
		}

		return {
			errors,
			renamedCount,
			success: errors.length === 0,
		};
	}

	/**
	 * Collect all .md files in the library folder.
	 */
	private collectMdFilesInLibrary(libraryRoot: string): TFile[] {
		const rootFolder = this.app.vault.getAbstractFileByPath(libraryRoot);
		if (!rootFolder) {
			logger.warn(
				`[DelimiterChangeService] Library folder "${libraryRoot}" not found`,
			);
			return [];
		}

		return this.app.vault.getFiles().filter((f) => {
			return (
				f.path.startsWith(`${libraryRoot}/`) && f.path.endsWith(".md")
			);
		});
	}

	/**
	 * Build rename actions for files that need delimiter changes.
	 */
	private buildRenameActions(
		files: TFile[],
		oldConfig: SuffixDelimiterConfig,
		newConfig: SuffixDelimiterConfig,
	): VaultAction[] {
		const oldPattern = buildFlexibleDelimiterPattern(oldConfig);
		const newDelim = buildCanonicalDelimiter(newConfig);
		const symbolChanged = oldConfig.symbol !== newConfig.symbol;

		// Find escape char not present in either delimiter symbol
		const escapeCandidates = ["_", "~", ".", " ", "-", "+", "="];
		const escapeChar =
			escapeCandidates.find(
				(c) =>
					!oldConfig.symbol.includes(c) &&
					!newConfig.symbol.includes(c),
			) ?? "_";

		const actions: VaultAction[] = [];

		for (const file of files) {
			// Check if file needs renaming (has old delimiter pattern)
			if (!oldPattern.test(file.basename)) {
				continue;
			}

			const parts = file.basename.split(oldPattern);
			if (parts.length <= 1) {
				continue;
			}

			// Escape new symbol in each part (node name) if symbol is changing
			let escapedParts = parts;
			if (symbolChanged) {
				const newSymbolRegex = new RegExp(
					newConfig.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
					"g",
				);
				escapedParts = parts.map((part) =>
					part.replace(newSymbolRegex, escapeChar),
				);
			}

			const newBasename = escapedParts.join(newDelim);
			if (newBasename === file.basename) {
				continue;
			}

			// Build from/to split paths
			const fromSplitPath = makeSplitPath(file) as SplitPathToMdFile;
			const toSplitPath: SplitPathToMdFile = {
				...fromSplitPath,
				basename: newBasename,
			};

			actions.push({
				kind: VaultActionKind.RenameMdFile,
				payload: {
					from: fromSplitPath,
					to: toSplitPath,
				},
			});
		}

		return actions;
	}

	/**
	 * Split an array into chunks of specified size.
	 */
	private chunkArray<T>(arr: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < arr.length; i += size) {
			chunks.push(arr.slice(i, i + size));
		}
		return chunks;
	}
}
