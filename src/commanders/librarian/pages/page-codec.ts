import type { CodecRules, NodeName } from "@textfresser/library-core";
import { serializeSeparatedSuffix } from "@textfresser/library-core";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { PAGE_INDEX_DIGITS, PAGE_PREFIX } from "./types";


/**
 * Builds page basename from page index and source file info.
 *
 * @example
 * buildPageBasename(1, "Aschenputtel", ["Märchen"], rules)
 * // → "Aschenputtel_Page_001-Aschenputtel-Märchen"
 */
export function buildPageBasename(
	pageIndex: number,
	coreName: NodeName,
	suffixParts: NodeName[],
	rules: CodecRules,
): string {
	const paddedIndex = String(pageIndex).padStart(PAGE_INDEX_DIGITS, "0");
	const pagePrefix = `${coreName}_${PAGE_PREFIX}_${paddedIndex}`;
	return serializeSeparatedSuffix(rules, {
		coreName: pagePrefix,
		suffixParts: [coreName, ...suffixParts],
	});
}

/**
 * Builds folder basename for pages (same as source coreName).
 *
 * @example
 * buildPageFolderBasename("Aschenputtel")
 * // → "Aschenputtel"
 */
export function buildPageFolderBasename(coreName: NodeName): string {
	return coreName;
}

/**
 * Pattern to detect page prefix in basename.
 * Matches: "Aschenputtel_Page_001" (coreName_Page_NNN)
 */
const PAGE_PREFIX_PATTERN = new RegExp(
	`^(.+)_${PAGE_PREFIX}_(\\d{${PAGE_INDEX_DIGITS}})$`,
);

/**
 * Parses page index from a node name if it matches page prefix pattern.
 */
export function parsePageIndex(
	nodeName: string,
): { isPage: true; pageIndex: number; coreName: string } | { isPage: false } {
	const match = nodeName.match(PAGE_PREFIX_PATTERN);
	if (match?.[1] && match?.[2]) {
		return {
			coreName: match[1],
			isPage: true,
			pageIndex: Number.parseInt(match[2], 10),
		};
	}
	return { isPage: false };
}

/**
 * Pattern to find page index in full basename.
 * Matches: "_Page_001" anywhere in string.
 */
const PAGE_INDEX_IN_BASENAME_PATTERN = new RegExp(
	`_${PAGE_PREFIX}_(\\d{${PAGE_INDEX_DIGITS}})`,
);




/**
 * Find adjacent pages using VaultActionManager.list()
 * Returns which pages exist (prev/next) based on actual folder contents.
 */
export const getAdjacentPageInfo = Effect.fn("Librarian.getAdjacentPageInfo")(
	function* (
		vam: VaultActionManager,
		currentPage: SplitPathToMdFile,
	): Effect.fn.Return<{ hasPrevPage: boolean; hasNextPage: boolean }> {
		// Extract current page's coreName and index
		const match = currentPage.basename.match(
			PAGE_INDEX_IN_BASENAME_PATTERN,
		);
		if (!match?.[1]) {
			return { hasNextPage: false, hasPrevPage: false };
		}
		const currentIndex = Number.parseInt(match[1], 10);

		// Extract coreName from basename (before _Page_)
		const coreMatch = currentPage.basename.match(
			new RegExp(`^(.+?)_${PAGE_PREFIX}_`),
		);
		if (!coreMatch?.[1]) {
			return { hasNextPage: false, hasPrevPage: false };
		}
		const coreName = coreMatch[1];

		// Build parent folder path from currentPage
		const parentFolder: SplitPathToFolder = {
			basename:
				currentPage.pathParts[currentPage.pathParts.length - 1] ?? "",
			kind: SplitPathKind.Folder,
			pathParts: currentPage.pathParts,
		};

		// List all files in parent folder
		const entries = yield* vam
			.list(parentFolder)
			.pipe(Effect.catch(() => Effect.succeed([])));

		// Build page pattern: coreName_Page_NNN
		const pagePattern = new RegExp(
			`^${coreName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_${PAGE_PREFIX}_(\\d{${PAGE_INDEX_DIGITS}})`,
		);

		// Collect all page indices for this coreName
		const pageIndices: number[] = [];
		for (const entry of entries) {
			if (entry.kind !== SplitPathKind.MdFile) continue;
			const pageMatch = entry.basename.match(pagePattern);
			if (pageMatch?.[1]) {
				pageIndices.push(Number.parseInt(pageMatch[1], 10));
			}
		}

		// Check if prev/next exist
		const hasPrevPage = pageIndices.includes(currentIndex - 1);
		const hasNextPage = pageIndices.includes(currentIndex + 1);

		return { hasNextPage, hasPrevPage };
	},
);
