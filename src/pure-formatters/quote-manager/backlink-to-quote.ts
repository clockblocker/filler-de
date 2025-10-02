import { z } from 'zod';
import { BacklinkToQuote } from './types';
import { reEscape, reEscapeCharClass } from '../text-utils';
import {
	PIPE,
	HASH,
	STAR,
	OBSIDIAN_LINK_OPEN,
	BIRD,
	OBSIDIAN_LINK_CLOSE,
} from '../../types/beta/literals';

// For characters inside a character class [...]

// Forbidden filename characters (based on your link syntax)
const FORBIDDEN_FILENAME_CHARS = ['[', ']', PIPE, HASH];

// Build a filename validation regex that excludes the forbidden chars
const FILE_NAME_CLASS = new RegExp(
	`^[^${FORBIDDEN_FILENAME_CHARS.map(reEscapeCharClass).join('')}]+$`
);

const BACKLINK_TO_QUOTE = {
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

export function makeFormattedBacklinkToQuote(input: BacklinkToQuote) {
	const { fileName = '', linkId = '' as any } = input;
	return BACKLINK_TO_QUOTE.make({ fileName, linkId });
}

export function extractFormattedBacklinkToQuote(
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
