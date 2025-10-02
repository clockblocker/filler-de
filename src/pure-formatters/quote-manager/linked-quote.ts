import { z } from 'zod';
import { LinkedQuote } from './types';
import { reEscape } from '../text-utils';
import { BIRD, SPACE_F, LINE_BREAK } from '../../types/beta/literals';

export const LINKED_QUOTE = {
	make({ text, linkId }: LinkedQuote) {
		return `${SPACE_F}${text}${SPACE_F}${BIRD}${linkId}${SPACE_F}${LINE_BREAK}` as const;
	},

	pattern: new RegExp(`^(?<text>[\\s\\S]*?) *${reEscape(BIRD)}(?<linkId>\\d+)`),

	schema: z.object({
		text: z.string().min(1),
		linkId: z.coerce.number().int().nonnegative(),
	}),
} as const;

export function makeFormattedLinkedQuote(input: LinkedQuote): string {
	const { text, linkId } = input;
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
