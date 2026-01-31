/**
 * Sharded path computation for dictionary entries.
 *
 * Generates deterministic folder structure based on word name:
 * Worter/Ordered/<first>/<prefix>/<shard>
 *
 * Example: "anfangen" → ["Worter", "Ordered", "a", "anf", "anfan"]
 */

// ─── Constants ───

const WORTER_ROOT = "Worter";
const ORDERED_FOLDER = "Ordered";
const PREFIX_LENGTH = 3;
const SHARD_LENGTH = 5;

// ─── Public API ───

/**
 * Computes sharded folder path parts for a dictionary entry.
 *
 * @param originalName - The word/file basename (e.g., "anfangen")
 * @returns Path parts array: ["Worter", "Ordered", first, prefix, shard]
 */
export function computeShardedFolderParts(originalName: string): string[] {
	const normalized = originalName.toLowerCase();

	// First character (handles empty string edge case)
	const first = normalized.charAt(0) || "_";

	// First 3 characters (or less if word is shorter)
	const prefix = normalized.slice(0, PREFIX_LENGTH) || first;

	// First 5 characters (or less if word is shorter)
	const shard = normalized.slice(0, SHARD_LENGTH) || prefix;

	return [WORTER_ROOT, ORDERED_FOLDER, first, prefix, shard];
}
