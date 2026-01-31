import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import {
	type EventHandler,
	HandlerOutcome,
	type SelectAllPayload,
} from "../../obsidian/user-event-interceptor";

/**
 * Create a handler for smart select-all.
 * Excludes frontmatter, go-back links, and metadata sections.
 */
export function createSelectAllHandler(): EventHandler<SelectAllPayload> {
	return {
		doesApply: () => true, // Always try to handle select-all events
		handle: (payload) => {
			const { from, to } = calculateSmartRange(payload.content);

			// If the range covers everything or nothing, passthrough
			if ((from === 0 && to === payload.content.length) || from >= to) {
				return { outcome: HandlerOutcome.Passthrough };
			}

			// Return modified payload with custom selection
			return {
				data: { ...payload, customSelection: { from, to } },
				outcome: HandlerOutcome.Modified,
			};
		},
	};
}

/**
 * Calculate smart selection range that excludes:
 * 1. YAML frontmatter (--- ... ---)
 * 2. Go-back links at the start ([[__...]])
 * 3. Metadata section at the end (<section id="textfresser_meta...">)
 */
function calculateSmartRange(content: string): { from: number; to: number } {
	if (!content || content.length === 0) {
		return { from: 0, to: 0 };
	}

	let from = 0;
	let to = content.length;

	// Step 1: Skip YAML frontmatter (not JSON - that's at the end)
	const afterFrontmatter = noteMetadataHelper.stripFrontmatter(content);
	if (afterFrontmatter.length < content.length) {
		from = content.length - afterFrontmatter.length;
	}

	// Step 2: Skip go-back link
	const afterGoBack = goBackLinkHelper.strip(afterFrontmatter);
	if (afterGoBack.length < afterFrontmatter.length) {
		from += afterFrontmatter.length - afterGoBack.length;
	}

	// Step 3: Find metadata section start (already excludes preceding whitespace)
	const metaSectionStart = noteMetadataHelper.findSectionStart(content);
	if (metaSectionStart !== null) {
		to = metaSectionStart;
	}

	// Handle edge case where everything is excluded
	if (from >= to) {
		return { from: 0, to: 0 };
	}

	return { from, to };
}
