import z from "zod/v3";

const morphemeDecorationDashPattern = /^[-\u2010-\u2015]|[-\u2010-\u2015]$/u;

export const MorphemeCanonicalLemmaSchema = z
	.string()
	.min(1)
	.refine((canonicalLemma) => !morphemeDecorationDashPattern.test(canonicalLemma), {
		message:
			"morpheme canonicalLemma must not use dash decorations; store the bare morpheme text instead",
	});
