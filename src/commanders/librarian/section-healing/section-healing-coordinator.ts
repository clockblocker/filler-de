import type { VaultAction } from "../../../managers/obsidian/vault-action-manager";
import { MD } from "../../../managers/obsidian/vault-action-manager/types/literals";
import { logger } from "../../../utils/logger";
import type { SplitHealingInfo } from "../bookkeeper/split-to-pages-action";
import type { CodecRules, Codecs } from "../codecs";
import type { ScrollNodeSegmentId } from "../codecs/segment-id/types/segment-id";
import type { Healer } from "../healer/healer";
import type { CodexImpact } from "../healer/library-tree/codex";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../healer/library-tree/tree-node/types/atoms";
import { assembleVaultActions, processCodexImpacts } from "../librarian-init";

/**
 * Dependencies for section healing.
 */
export type SectionHealingDeps = {
	healer: Healer;
	codecs: Codecs;
	rules: CodecRules;
	dispatch: (actions: VaultAction[]) => Promise<void>;
};

/**
 * Trigger section healing for a newly created section.
 * Called by Bookkeeper to bypass self-event filtering.
 *
 * @param deps - Dependencies for healing (healer, codecs, rules, dispatch)
 * @param info - Contains section chain, deleted scroll, and page node names
 */
export async function triggerSectionHealing(
	deps: SectionHealingDeps,
	info: SplitHealingInfo,
): Promise<void> {
	const { healer, codecs, rules, dispatch } = deps;
	const { sectionChain, deletedScrollSegmentId, pageNodeNames } = info;

	// Delete the old scroll from the tree (self-event filtering blocked the Delete event)
	// The scroll was in the parent section
	if (sectionChain.length > 1) {
		const parentChain = sectionChain.slice(0, -1);
		const parentSection = healer.findSection(parentChain);
		if (parentSection) {
			delete parentSection.children[deletedScrollSegmentId];
		}
	}

	// Ensure the section chain exists in the tree
	// (self-event filtering blocked the normal Create events)
	const section = healer.ensureSectionChain(sectionChain);

	// Populate section with page scroll nodes BEFORE codex generation
	// (self-event filtering will block the page Create events, so we add them here)
	for (const pageName of pageNodeNames) {
		const scrollSegId = codecs.segmentId.serializeSegmentId({
			coreName: pageName,
			extension: MD,
			targetKind: TreeNodeKind.Scroll,
		}) as ScrollNodeSegmentId;

		section.children[scrollSegId] = {
			extension: MD,
			kind: TreeNodeKind.Scroll,
			nodeName: pageName,
			status: TreeNodeStatus.NotStarted,
		};
	}

	// Build impacted chains: the new section + its parent (for codex content update)
	const chainKey = sectionChain.join("/");
	const impactedChains = new Set([chainKey]);

	// Parent section also needs codex regeneration (its children changed)
	if (sectionChain.length > 1) {
		const parentChain = sectionChain.slice(0, -1);
		impactedChains.add(parentChain.join("/"));
	}

	// Create synthetic CodexImpact for the impacted sections
	const codexImpact: CodexImpact = {
		contentChanged: [],
		deleted: [],
		descendantsChanged: [],
		impactedChains,
		renamed: [],
	};

	// Process codex impact to generate vault actions
	const { codexRecreations } = processCodexImpacts(
		[codexImpact],
		healer,
		codecs,
	);

	// Assemble and dispatch vault actions
	const vaultActions = assembleVaultActions(
		[],
		codexRecreations,
		rules,
		codecs,
	);

	if (vaultActions.length > 0) {
		await dispatch(vaultActions);
	}
}
