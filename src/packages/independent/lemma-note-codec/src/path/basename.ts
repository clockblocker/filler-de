import { sha256Hex } from "../hash";

/**
 * The characters a basename percent-encodes (ADR 0013). `%` comes first, so
 * decoding is the exact inverse. Every other character is kept.
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

/** Percent-encodes the ADR 0013 characters; one entry per output character. */
function encodedChars(text: string): string[] {
	return Array.from(text, (char) =>
		ENCODED_SET.has(char) ? escapeOf(char) : char,
	);
}

/** Percent-encodes the ADR 0013 characters, with no length cap. */
export function encodeSegment(text: string): string {
	return encodedChars(text).join("");
}

const ESCAPE_PATTERN = /%([0-9A-F]{2})/g;
const DECODABLE: ReadonlySet<string> = new Set(
	ENCODED.map((char) => escapeOf(char)),
);

/**
 * Decodes {@link encodeSegment}, or returns undefined when the text is not
 * an encoding it produces: a raw reserved character, or a `%` escape of a
 * character it does not encode.
 */
export function decodeSegment(text: string): string | undefined {
	const withoutEscapes = text.replace(ESCAPE_PATTERN, (sequence) =>
		DECODABLE.has(sequence) ? "" : sequence,
	);
	for (const char of withoutEscapes) {
		if (ENCODED_SET.has(char)) return undefined;
	}
	return text.replace(ESCAPE_PATTERN, (_sequence, hex: string) =>
		String.fromCharCode(Number.parseInt(hex, 16)),
	);
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
 * full form. Returns undefined for text the encoder never produces.
 */
export function decodeBasename(basename: string): DecodedBasename | undefined {
	const shortened = SHORTENED_PATTERN.exec(basename);
	const prefix = shortened?.[1];
	const hash = shortened?.[2];
	if (
		prefix !== undefined &&
		hash !== undefined &&
		codePoints(prefix) <= BASENAME_KEPT &&
		codePoints(prefix) > BASENAME_KEPT - 3
	) {
		const canonicalFormPrefix = decodeSegment(prefix);
		if (canonicalFormPrefix !== undefined)
			return { canonicalFormPrefix, hash, truncated: true };
	}
	const canonicalForm = decodeSegment(basename);
	if (canonicalForm === undefined || canonicalForm.length === 0)
		return undefined;
	return { canonicalForm, truncated: false };
}
