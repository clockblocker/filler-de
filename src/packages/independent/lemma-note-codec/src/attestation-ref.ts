/**
 * Attestation Refs (spec: Attestation Refs): how a Reading note names the
 * place in a Scroll where an occurrence stands. A ref is an embed of the
 * occurrence's block whose alias keys the occurrence,
 * `![[Story#^0|^1a2b3c4d]]`. Its link path is the Scroll's basename, or its
 * vault path without `.md` where Obsidian opens another note for the
 * basename; the dictionary store decides which (`scrollRefNames`).
 *
 * Obsidian's link updater cannot see a ref in a note's metadata, but it
 * sees, and rewrites, the embed the Reading note shows under Deine
 * Kontexte when the Scroll moves. `retargetedRefLines` tells such a line
 * from the user's text: it is a stored ref with only its link path changed.
 */

/** A ref's parts: the Scroll it names, the block, and the occurrence's key. */
export type AttestationRefParts = {
	readonly linkpath: string;
	readonly blockId: string;
	readonly occurrence: string;
};

/** What every Attestation Ref starts with, whichever Scroll it names. */
export const ATTESTATION_REF_START = "![[";

const ATTESTATION_REF =
	/^!\[\[([^\]#|\n]+)#\^([A-Za-z0-9-]+)\|\^([0-9a-f]{8})\]\]$/u;

/** The ref of one occurrence: `![[<linkpath>#^<blockId>|^<occurrence>]]`. */
export function attestationRef(parts: AttestationRefParts): string {
	return `${attestationRefPrefix(parts.linkpath)}${parts.blockId}|^${parts.occurrence}]]`;
}

/** What every ref into the Scroll at `linkpath` starts with: `![[Story#^`. */
export function attestationRefPrefix(linkpath: string): string {
	return `${ATTESTATION_REF_START}${linkpath}#^`;
}

/** The parts of a ref `attestationRef` wrote, if it is one. */
export function parseAttestationRef(
	ref: string,
): AttestationRefParts | undefined {
	const match = ATTESTATION_REF.exec(ref);
	if (!match) return undefined;
	const [, linkpath = "", blockId = "", occurrence = ""] = match;
	return { blockId, linkpath, occurrence };
}

/** The same ref naming its Scroll by another link path. */
export const retargetedRef = (
	parts: AttestationRefParts,
	linkpath: string,
): string => attestationRef({ ...parts, linkpath });

/** A body line that is one of `refs` with another link path. */
export type RetargetedRefLine = {
	/** The line's index in the body. */
	readonly line: number;
	/** The stored ref the line shows. */
	readonly ref: string;
	/** The link path the line names the Scroll by instead. */
	readonly linkpath: string;
};

const occurrenceKey = ({ blockId, occurrence }: AttestationRefParts) =>
	`${blockId}\u0000${occurrence}`;

/**
 * The lines of `lines` that show one of `refs` with only its link path
 * changed, as Obsidian's link updater leaves them after the Scroll moved.
 * A line counts only as a whole ref: the occurrence key in its alias and
 * its block name exactly one stored ref.
 */
export function retargetedRefLines(
	lines: readonly string[],
	refs: readonly string[],
): RetargetedRefLine[] {
	const stored = new Map<string, string | null>();
	for (const ref of refs) {
		const parts = parseAttestationRef(ref);
		if (!parts) continue;
		const key = occurrenceKey(parts);
		stored.set(key, stored.has(key) ? null : ref);
	}
	const found: RetargetedRefLine[] = [];
	for (const [index, raw] of lines.entries()) {
		const parts = parseAttestationRef(raw.replace(/\r$/u, ""));
		if (!parts) continue;
		const ref = stored.get(occurrenceKey(parts));
		if (!ref || ref === attestationRef(parts)) continue;
		found.push({ line: index, linkpath: parts.linkpath, ref });
	}
	return found;
}
