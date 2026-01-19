/**
 * OrphanCodexScanner - Finds and cleans up orphaned codex files.
 *
 * Orphaned codexes occur when:
 * - Folders are moved/renamed but codex suffix isn't updated
 * - Manual file operations break the tree structure
 * - Bugs in healing logic leave stale codexes
 *
 * This scanner compares vault state against expected codex paths
 * and generates cleanup actions for mismatched codexes.
 */

import type { Codecs, SplitPathToMdFileInsideLibrary } from "../codecs";
import type { SectionNodeSegmentId } from "../codecs/segment-id/types/segment-id";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { TreeNodeKind } from "./library-tree/tree-node/types/atoms";
import { computeCodexSplitPath } from "./library-tree/codex/codex-split-path";
import { isCodexSplitPath } from "./library-tree/codex/helpers";
import type { HealingAction } from "./library-tree/types/healing-action";
import type { TreeReader } from "./library-tree/tree-interfaces";

// ─── Types ───

type OrphanedCodex = {
	/** Observed path of the orphaned codex */
	observedPath: SplitPathToMdFileInsideLibrary;
	/** Expected path (if section exists) or null (if section missing) */
	expectedPath: SplitPathToMdFileInsideLibrary | null;
	/** Reason why this codex is considered orphaned */
	reason: "wrong_suffix" | "missing_section" | "duplicate";
};

type ScanResult = {
	/** Orphaned codexes found */
	orphans: OrphanedCodex[];
	/** Sections missing codexes */
	missingSections: SectionNodeSegmentId[][];
	/** Total codexes scanned */
	scannedCount: number;
};

// ─── OrphanCodexScanner ───

export class OrphanCodexScanner {
	private codecs: Codecs;
	private tree: TreeReader;

	constructor(tree: TreeReader, codecs: Codecs) {
		this.tree = tree;
		this.codecs = codecs;
	}

	/**
	 * Scan vault paths for orphaned codexes.
	 *
	 * @param vaultPaths - All file paths in the library (as split paths)
	 * @returns Scan result with orphans and missing sections
	 */
	scan(vaultPaths: SplitPathToMdFileInsideLibrary[]): ScanResult {
		const orphans: OrphanedCodex[] = [];
		const seenSectionPaths = new Set<string>();
		let scannedCount = 0;

		// Filter to only codex files
		const codexPaths = vaultPaths.filter((p) => isCodexSplitPath(p));

		for (const observedPath of codexPaths) {
			scannedCount++;

			// Build section chain from path parts
			const sectionChainResult = this.buildSectionChain(
				observedPath.pathParts,
			);
			if (sectionChainResult === null) {
				// Parse error - treat as orphan
				orphans.push({
					expectedPath: null,
					observedPath,
					reason: "wrong_suffix",
				});
				continue;
			}

			const sectionChain = sectionChainResult;
			const sectionKey = sectionChain.join("/");

			// Check for duplicates
			if (seenSectionPaths.has(sectionKey)) {
				orphans.push({
					expectedPath: null,
					observedPath,
					reason: "duplicate",
				});
				continue;
			}
			seenSectionPaths.add(sectionKey);

			// Verify section exists in tree
			const section = this.findSection(sectionChain);
			if (!section) {
				orphans.push({
					expectedPath: null,
					observedPath,
					reason: "missing_section",
				});
				continue;
			}

			// Compute expected codex path for this section
			const expectedPath = computeCodexSplitPath(sectionChain, this.codecs);

			// Compare basenames (suffix)
			if (observedPath.basename !== expectedPath.basename) {
				orphans.push({
					expectedPath,
					observedPath,
					reason: "wrong_suffix",
				});
			}
		}

		// Find sections missing codexes
		const missingSections = this.findMissingSections(seenSectionPaths);

		return {
			missingSections,
			orphans,
			scannedCount,
		};
	}

	/**
	 * Generate cleanup actions for orphaned codexes.
	 */
	generateCleanupActions(orphans: OrphanedCodex[]): HealingAction[] {
		const actions: HealingAction[] = [];

		for (const orphan of orphans) {
			// Delete the orphaned codex
			actions.push({
				kind: "DeleteMdFile",
				payload: { splitPath: orphan.observedPath },
			});
		}

		return actions;
	}

	/**
	 * Generate recreation actions for missing sections.
	 */
	generateRecreationActions(
		missingSections: SectionNodeSegmentId[][],
	): HealingAction[] {
		const actions: HealingAction[] = [];

		for (const chain of missingSections) {
			const section = this.findSection(chain);
			if (!section) continue;

			const splitPath = computeCodexSplitPath(chain, this.codecs);

			// Create folder (if needed) and codex file
			// Note: Actual codex content generation is handled by CodexAction processors
			actions.push({
				kind: "CreateFolder",
				payload: { splitPath: this.toFolderPath(splitPath) },
			});
		}

		return actions;
	}

	// ─── Helpers ───

	private buildSectionChain(
		pathParts: string[],
	): SectionNodeSegmentId[] | null {
		const chain: SectionNodeSegmentId[] = [];

		for (const nodeName of pathParts) {
			const segIdResult = this.codecs.segmentId.serializeSegmentIdUnchecked({
				coreName: nodeName,
				targetKind: TreeNodeKind.Section,
			});
			if (segIdResult.isErr()) {
				return null;
			}
			chain.push(segIdResult.value as SectionNodeSegmentId);
		}

		return chain;
	}

	private findSection(chain: SectionNodeSegmentId[]) {
		if (chain.length === 0) return undefined;
		if (chain.length === 1) return this.tree.getRoot();
		return this.tree.findSection(chain);
	}

	private findMissingSections(
		seenPaths: Set<string>,
	): SectionNodeSegmentId[][] {
		const missing: SectionNodeSegmentId[][] = [];

		// Traverse tree and check each section
		const traverse = (
			chain: SectionNodeSegmentId[],
			section: { children: Record<string, unknown> },
		): void => {
			const key = chain.join("/");
			if (!seenPaths.has(key)) {
				missing.push(chain);
			}

			for (const [segId, child] of Object.entries(section.children)) {
				if (
					typeof child === "object" &&
					child !== null &&
					"children" in child
				) {
					traverse(
						[...chain, segId as SectionNodeSegmentId],
						child as { children: Record<string, unknown> },
					);
				}
			}
		};

		const root = this.tree.getRoot();
		const rootSegId = this.codecs.segmentId.serializeSegmentId({
			coreName: root.nodeName,
			targetKind: TreeNodeKind.Section,
		}) as SectionNodeSegmentId;

		traverse([rootSegId], root);

		return missing;
	}

	private toFolderPath(mdPath: SplitPathToMdFileInsideLibrary): {
		kind: typeof SplitPathKind.Folder;
		pathParts: string[];
		basename: string;
	} {
		return {
			basename: mdPath.pathParts[mdPath.pathParts.length - 1] ?? "",
			kind: SplitPathKind.Folder,
			pathParts: mdPath.pathParts.slice(0, -1),
		};
	}
}

// ─── Convenience Function ───

/**
 * Scan and generate all cleanup/recreation actions.
 *
 * @param tree - Tree reader for section lookup
 * @param codecs - Codecs for path parsing
 * @param vaultPaths - All md file paths in the library
 * @returns All healing actions needed to fix orphan issues
 */
export function scanAndGenerateOrphanActions(
	tree: TreeReader,
	codecs: Codecs,
	vaultPaths: SplitPathToMdFileInsideLibrary[],
): {
	cleanupActions: HealingAction[];
	recreationActions: HealingAction[];
	scanResult: ScanResult;
} {
	const scanner = new OrphanCodexScanner(tree, codecs);
	const scanResult = scanner.scan(vaultPaths);

	return {
		cleanupActions: scanner.generateCleanupActions(scanResult.orphans),
		recreationActions: scanner.generateRecreationActions(
			scanResult.missingSections,
		),
		scanResult,
	};
}
