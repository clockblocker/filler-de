import { z } from 'zod';
import { SPACE_F, BIRD } from '../../../../types/beta/literals';
import { LINE_BREAK } from '../../../note-block-manager/note-block-management/types-and-constants';
import { reEscape } from '../../../text-utils';
import { LinkedQuote } from '../../types';

export const LINKED_QUOTE = {
	make({ text, linkId }: LinkedQuote) {
		return `${SPACE_F}${text}${SPACE_F}${BIRD}${linkId}${LINE_BREAK}`;
	},

	pattern: new RegExp(`^(?<text>[\\s\\S]*?) *${reEscape(BIRD)}(?<linkId>\\d+)`),

	schema: z.object({
		text: z.string().min(1),
		linkId: z.coerce.number().int().nonnegative(),
	}),
} as const;

export function makeFormattedLinkedQuote({
	text,
	linkId,
}: LinkedQuote): string {
	return LINKED_QUOTE.make({ text, linkId });
}

export function extractFormattedLinkedQuote(
	formatted: string
): LinkedQuote | null {
	const m = LINKED_QUOTE.pattern.exec(formatted);
	if (!m?.groups) return null;

	const parsed = LINKED_QUOTE.schema.safeParse({
		text: m.groups.text.trim(),
		linkId: m.groups.linkId,
	});
	return parsed.success ? parsed.data : null;
}
