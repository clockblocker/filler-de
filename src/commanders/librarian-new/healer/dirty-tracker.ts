/**
 * Tracks dirty sections for pull-based lazy healing.
 * Instead of computing healing immediately after each action,
 * we mark sections as dirty and compute healing in batches.
 */

import type { SectionNodeSegmentId } from "../codecs/segment-id/types/segment-id";

// ─── Types ───

export type DirtyReason = "content" | "suffix" | "status";

export type DirtyNode = {
	chain: SectionNodeSegmentId[];
	reasons: Set<DirtyReason>;
};

// ─── DirtyTracker ───

/**
 * Tracks dirty sections that need healing.
 * Supports batched/deferred healing computation.
 */
export class DirtyTracker {
	private dirty: Map<string, DirtyNode> = new Map();

	/**
	 * Mark a section chain as dirty with a given reason.
	 * Multiple calls with the same chain accumulate reasons.
	 */
	markDirty(chain: SectionNodeSegmentId[], reason: DirtyReason): void {
		const key = this.chainToKey(chain);
		const existing = this.dirty.get(key);

		if (existing) {
			existing.reasons.add(reason);
		} else {
			this.dirty.set(key, {
				chain: [...chain],
				reasons: new Set([reason]),
			});
		}
	}

	/**
	 * Mark all sections in impactedChains as dirty.
	 * Convenience method for batch marking from CodexImpact.
	 */
	markAllDirty(impactedChains: Set<string>, reason: DirtyReason): void {
		for (const chainKey of impactedChains) {
			const chain = chainKey.split("/") as SectionNodeSegmentId[];
			this.markDirty(chain, reason);
		}
	}

	/**
	 * Flush all dirty nodes and return them.
	 * Clears the internal dirty set.
	 */
	flush(): DirtyNode[] {
		const nodes = Array.from(this.dirty.values());
		this.dirty.clear();
		return nodes;
	}

	/**
	 * Check if there are any dirty nodes.
	 */
	isEmpty(): boolean {
		return this.dirty.size === 0;
	}

	/**
	 * Get count of dirty nodes (for debugging).
	 */
	size(): number {
		return this.dirty.size;
	}

	// ─── Private ───

	private chainToKey(chain: SectionNodeSegmentId[]): string {
		return chain.join("/");
	}
}
