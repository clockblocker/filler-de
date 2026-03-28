export const SECTION_KEYS = [
	"header",
	"attestation",
	"translation",
	"relation",
	"morphem",
	"morphology",
	"inflection",
	"tags",
	"freeform",
	"deviation",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
