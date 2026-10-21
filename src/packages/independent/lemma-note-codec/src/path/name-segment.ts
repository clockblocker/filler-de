/**
 * The one helper that spells every folder and file name of a dictionary
 * note (ADR-0015): each shard folder, each file name and each text slot.
 * Names are lossy; the real spelling always lives in the note's metadata.
 * It belongs to the Obsidian host, not the batteries, because the web host
 * has no file names.
 */

/** A segment is capped at this many UTF-8 bytes, cut at a grapheme boundary. */
export const NAME_SEGMENT_MAX_BYTES = 255;

/**
 * The cap of a file name without its `.md`, so that the whole file name
 * still fits {@link NAME_SEGMENT_MAX_BYTES}, the limit of APFS, NTFS and
 * ext4.
 */
export const FILE_NAME_MAX_BYTES = NAME_SEGMENT_MAX_BYTES - ".md".length;

/**
 * What a segment becomes when nothing else is left, and the prefix of a
 * Windows reserved name. `_`, `+` and `~` already mean null slot, value set
 * and Syncretism in the identity folders; `@` is legal in Obsidian names
 * and links and means nothing else in a path.
 */
export const NAME_SEGMENT_FALLBACK = "@";
export const RESERVED_NAME_PREFIX = "@";

/** `/ \ : * ? " < > | # ^ [ ]` and control characters (`\p{Cc}`). */
export const DROPPED_CHARACTERS = /[/\\:*?"<>|#^[\]\p{Cc}]/gu;
const WHITESPACE_RUN = /\s+/gu;
const EDGE_SPACES_AND_DOTS = /^[ .]+|[ .]+$/gu;
/** Compared case-insensitively on the part before the first dot. */
const RESERVED_BASE = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu;

/**
 * A spelling as a folder or file name segment. The rules, in order:
 *
 * 1. NFC normalize.
 * 2. Drop `/ \ : * ? " < > | # ^ [ ]` and control characters.
 * 3. Collapse each run of whitespace to one space.
 * 4. Trim leading and trailing spaces and dots.
 * 5. Prefix the Windows reserved base names (CON, PRN, AUX, NUL, COM1–COM9,
 *    LPT1–LPT9, before the first dot, any case) with `@`.
 * 6. Cap the segment at `maxBytes` UTF-8 bytes, 255 by default, cut at a
 *    grapheme boundary.
 * 7. Fall back to `@` when nothing is left.
 *
 * `ß`, `ẞ` and umlauts are never converted. The function is idempotent:
 * NFC runs again after characters are dropped, since a drop can bring a
 * base and a combining mark together, and a cut is trimmed and checked for
 * a reserved name again, so a second call changes nothing.
 */
export function toNameSegment(
	spelling: string,
	maxBytes: number = NAME_SEGMENT_MAX_BYTES,
): string {
	const cleaned = trimEdges(
		spelling
			.normalize("NFC")
			.replace(DROPPED_CHARACTERS, "")
			.normalize("NFC")
			.replace(WHITESPACE_RUN, " "),
	);
	const capped = guardReserved(
		trimEdges(capBytes(guardReserved(cleaned), maxBytes)),
	);
	return capped === "" ? NAME_SEGMENT_FALLBACK : capped;
}

/** Whether a segment's part before its first dot is a Windows device name. */
export function isReservedName(segment: string): boolean {
	return RESERVED_BASE.test(segment.split(".", 1)[0] ?? "");
}

function trimEdges(text: string): string {
	return text.replace(EDGE_SPACES_AND_DOTS, "");
}

function guardReserved(segment: string): string {
	return isReservedName(segment)
		? `${RESERVED_NAME_PREFIX}${segment}`
		: segment;
}

const encoder = new TextEncoder();
let segmenter: Intl.Segmenter | undefined;

/** A string's user-perceived characters. */
export function graphemesOf(text: string): string[] {
	segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
	return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

function utf8Length(text: string): number {
	return encoder.encode(text).length;
}

/** The longest run of whole graphemes from the start that fits `maxBytes`. */
function capBytes(text: string, maxBytes: number): string {
	if (utf8Length(text) <= maxBytes) return text;
	let kept = "";
	let bytes = 0;
	for (const grapheme of graphemesOf(text)) {
		const size = utf8Length(grapheme);
		if (bytes + size > maxBytes) break;
		kept += grapheme;
		bytes += size;
	}
	return kept;
}
