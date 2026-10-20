import { sha256Hex } from "../hash";

/**
 * The characters a path segment percent-encodes anywhere (ADR 0013), plus
 * `~`, which marks a shortened basename and a Syncretism slot. `%` comes
 * first, so decoding is the exact inverse. Every other character is kept,
 * except those {@link mustEscape} adds by position.
 */
const ENCODED = [
	"%",
	"*",
	'"',
	"\\",
	"/",
	"<",
	">",
	":",
	"|",
	"?",
	"#",
	"^",
	"[",
	"]",
	"~",
] as const;

const ENCODED_SET: ReadonlySet<string> = new Set(ENCODED);

/** An encoded basename longer than this many characters is shortened. */
export const BASENAME_LIMIT = 100;
/** A shortened basename keeps this many characters before its hash. */
export const BASENAME_KEPT = 80;
const HASH_LENGTH = 8;

function escapeOf(char: string): string {
	return `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;
}

/**
 * Whether a character is escaped where it stands: a reserved character, a
 * control character, a leading `.` (Obsidian hides dotfiles, and `.` or `..`
 * would leave the folder), and leading or trailing whitespace, which file
 * systems and sync services trim.
 */
function mustEscape(char: string, index: number, length: number): boolean {
	if (ENCODED_SET.has(char)) return true;
	const code = char.codePointAt(0) ?? 0;
	if (code < 0x20 || code === 0x7f) return true;
	if (index === 0 && char === ".") return true;
	return (index === 0 || index === length - 1) && /\s/u.test(char);
}

/** Percent-encodes a segment; one entry per input character. */
function encodedChars(text: string): string[] {
	const chars = Array.from(text);
	return chars.map((char, index) =>
		mustEscape(char, index, chars.length) &&
		(char.codePointAt(0) ?? 0) < 0x100
			? escapeOf(char)
			: char,
	);
}

/** Percent-encodes a path segment, with no length cap. */
export function encodeSegment(text: string): string {
	return encodedChars(text).join("");
}

const ESCAPE_PATTERN = /%([0-9A-F]{2})/g;

/**
 * Decodes {@link encodeSegment}, or returns undefined for text it never
 * produces, such as a raw reserved character or a needless escape.
 */
export function decodeSegment(text: string): string | undefined {
	const decoded = text.replace(ESCAPE_PATTERN, (_sequence, hex: string) =>
		String.fromCharCode(Number.parseInt(hex, 16)),
	);
	return encodeSegment(decoded) === text ? decoded : undefined;
}

/**
 * The basename of a Canonical Form (ADR 0013): percent-encoded, and when the
 * encoding is longer than 100 characters, its first 80 characters, `~` and
 * an 8-hex hash of the full Canonical Form. Characters count as code points,
 * and the cut never splits an escape.
 */
export function canonicalFormBasename(canonicalForm: string): string {
	const chars = encodedChars(canonicalForm);
	const length = chars.reduce((sum, char) => sum + codePoints(char), 0);
	if (length <= BASENAME_LIMIT) return chars.join("");
	let kept = "";
	let keptLength = 0;
	for (const char of chars) {
		const charLength = codePoints(char);
		if (keptLength + charLength > BASENAME_KEPT) break;
		kept += char;
		keptLength += charLength;
	}
	return `${kept}~${canonicalFormHash(canonicalForm)}`;
}

function codePoints(text: string): number {
	return Array.from(text).length;
}

function canonicalFormHash(canonicalForm: string): string {
	return sha256Hex(canonicalForm).slice(0, HASH_LENGTH);
}

export type DecodedBasename =
	| { readonly truncated: false; readonly canonicalForm: string }
	| {
			readonly truncated: true;
			/** The decoded first characters of the Canonical Form. */
			readonly canonicalFormPrefix: string;
			readonly hash: string;
	  };

const SHORTENED_PATTERN = /^(.+)~([0-9a-f]{8})$/u;

/**
 * Reverses {@link canonicalFormBasename}. A shortened basename keeps only
 * the Canonical Form's prefix and hash; the note's `identity` Block holds the
 * full form. `~` is always escaped inside a form, so a raw `~` can only be
 * the shortening mark. Returns undefined for text the encoder never
 * produces.
 */
export function decodeBasename(basename: string): DecodedBasename | undefined {
	const shortened = SHORTENED_PATTERN.exec(basename);
	if (shortened !== null) {
		const [, prefix = "", hash = ""] = shortened;
		const length = codePoints(prefix);
		// The cut backs off at most two characters to keep an escape whole.
		if (length > BASENAME_KEPT || length <= BASENAME_KEPT - 3)
			return undefined;
		// The prefix was encoded as the start of a longer form, so a trailing
		// space in it is not escaped; a sentinel restores that position.
		const decoded = decodeSegment(`${prefix}x`);
		return decoded === undefined
			? undefined
			: {
					canonicalFormPrefix: decoded.slice(0, -1),
					hash,
					truncated: true,
				};
	}
	const canonicalForm = decodeSegment(basename);
	if (canonicalForm === undefined || canonicalForm.length === 0)
		return undefined;
	return { canonicalForm, truncated: false };
}
