export const MARKER_RE = /^:::([a-z_]+)\s*$/u;
export const CLOSE_RE = /^:::\s*$/u;

export const KNOWN_BLOCK_IDS = new Set([
	"attestation",
	"header",
	"identity",
	"inflexion",
	"inherent_features",
	"inflection",
	"relation",
	"root_meta",
	"tags",
	"translation",
]);

export const JSON_BLOCK_IDS = new Set([
	"identity",
	"inflection",
	"inherent_features",
	"relation",
	"root_meta",
]);

export const SINGLETON_BLOCK_IDS = new Set([
	"header",
	"identity",
	"inflection",
	"inherent_features",
	"relation",
	"root_meta",
	"tags",
	"translation",
]);

export const CANONICAL_BLOCK_ORDER = [
	"identity",
	"root_meta",
	"header",
	"attestation",
	"translation",
	"relation",
	"inherent_features",
	"inflection",
	"tags",
	"structured_raw",
	"freeform",
] as const;
