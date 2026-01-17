import type { z } from "zod";
import type { Transform } from "../../obsidian/vault-action-manager/types/vault-action";

// ─── Constants ───

const META_SECTION_ID = "textfresser_meta_keep_me_invisible";
const SECTION = "section";

// Escape special regex chars
const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pattern to match metadata section (captures JSON content)
// Matches both id={...} (legacy) and id="..." (new) formats
const PATTERN = new RegExp(
	`\\n*<${SECTION}\\s+id=[\\{"]${reEscape(META_SECTION_ID)}[\\}"]>([\\s\\S]*?)<\\/${SECTION}>\\n*`,
);

// ─── Public API ───

type Metadata = Record<string, unknown>;

/**
 * Read metadata from note content.
 * Returns null if no metadata or parse fails.
 */
export function readMetadata<T extends Metadata>(
	contentOfNote: string,
	schema: z.ZodSchema<T>,
): T | null {
	const match = contentOfNote.match(PATTERN);
	if (!match?.[1]) return null;

	try {
		const parsed = schema.safeParse(JSON.parse(match[1].trim()));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * Format metadata as section string.
 */
function formatMetadata(metadata: Metadata): string {
	return `<${SECTION} id="${META_SECTION_ID}">\n${JSON.stringify(metadata)}\n</${SECTION}>`;
}

/**
 * Upsert metadata in note content.
 * Returns Transform function for use with ProcessMdFile.
 */
export function upsertMetadata(metadata: Metadata): Transform {
	return (content: string) => {
		// Remove existing metadata section
		const contentWithoutMeta = content.replace(PATTERN, "").trimEnd();

		// Add metadata at end with padding to push it below visible area
		const metaSection = formatMetadata(metadata);
		const PADDING = "\n".repeat(20);
		return `${contentWithoutMeta}${PADDING}${metaSection}\n`;
	};
}
