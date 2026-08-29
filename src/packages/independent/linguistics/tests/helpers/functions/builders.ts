export function makeLexemeSurfaceReference<lemmaSubKind extends string>(
	lemmaSubKind: lemmaSubKind,
	canonicalLemma: string,
) {
	return {
		discriminators: {
			lemmaKind: "Lexeme" as const,
			lemmaSubKind,
		},
		target: {
			canonicalLemma,
		},
	};
}


export function makePhrasemeSurfaceReference<lemmaSubKind extends string>(
	lemmaSubKind: lemmaSubKind,
	canonicalLemma: string,
) {
	return {
		discriminators: {
			lemmaKind: "Phraseme" as const,
			lemmaSubKind,
		},
		target: {
			canonicalLemma,
		},
	};
}
