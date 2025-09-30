import { z } from 'zod';
import { BacklinkToQuote } from './types';
import { reEscape, reEscapeCharClass } from '../text-utils';

// ── Delimiters / tokens ────────────────────────────────────────────────────────
export const STAR = '*' as const;
export const OBSIDIAN_LINK_OPEN = '[[' as const;
export const OBSIDIAN_LINK_CLOSE = ']]' as const;
export const PIPE = '|' as const; // name for |
export const HASH = '#' as const; // name for #
export const BIRD = '^' as const; // your caret delimiter

// For characters inside a character class [...]

// Forbidden filename characters (based on your link syntax)
const FORBIDDEN_FILENAME_CHARS = ['[', ']', PIPE, HASH];

// Build a filename validation regex that excludes the forbidden chars
const FILE_NAME_CLASS = new RegExp(
	`^[^${FORBIDDEN_FILENAME_CHARS.map(reEscapeCharClass).join('')}]+$`
);

export const BACKLINK_TO_QUOTE = {
	make({ fileName, linkId }: BacklinkToQuote) {
		return `${STAR}${OBSIDIAN_LINK_OPEN}${fileName}${HASH}${BIRD}${linkId}${PIPE}${BIRD}${OBSIDIAN_LINK_CLOSE}${STAR}` as const;
	},

	pattern: new RegExp(
		// ^\*\[\[(?<fileName>... )#\^(?<linkId>\d+)\|[^\]]*\]\]\*$
		`^${reEscape(STAR)}${reEscape(OBSIDIAN_LINK_OPEN)}(?<fileName>[^${FORBIDDEN_FILENAME_CHARS.map(reEscapeCharClass).join('')}]+)` +
			`${reEscape(HASH)}${reEscape(BIRD)}(?<linkId>\\d+)` +
			`${reEscape(PIPE)}[^${reEscapeCharClass(']')}]*${reEscape(OBSIDIAN_LINK_CLOSE)}${reEscape(STAR)}$`
	),

	schema: z.object({
		fileName: z.string().min(1).regex(FILE_NAME_CLASS),
		linkId: z.coerce.number().int().nonnegative(),
	}),
} as const;

export function makeBacklinkToQuote(input: BacklinkToQuote) {
	const { fileName = '', linkId = '' as any } = input;
	return BACKLINK_TO_QUOTE.make({ fileName, linkId });
}

export function parseBacklinkToQuote(
	formatted: string
): BacklinkToQuote | null {
	const m = BACKLINK_TO_QUOTE.pattern.exec(formatted);
	if (!m?.groups) return null;

	const parsed = BACKLINK_TO_QUOTE.schema.safeParse({
		fileName: m.groups.fileName,
		linkId: m.groups.linkId,
	});

	return parsed.success ? parsed.data : null;
}
