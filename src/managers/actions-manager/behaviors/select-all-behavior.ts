import { goBackLinkHelper } from "../../../stateless-helpers/go-back-link/go-back-link";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import { logger } from "../../../utils/logger";
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
		doesApply: (payload) => {
			const { from, to } = calculateSmartRange(payload.content);
			// Only intercept when we would set a custom selection (not passthrough)
			return (from !== 0 || to !== payload.content.length) && from < to;
		},
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
	logger.info("[calculateSmartRange] === START ===");
	logger.info("[calculateSmartRange] content.length:", content.length);
	logger.info(
		"[calculateSmartRange] first 300 chars:",
		JSON.stringify(content.slice(0, 300)),
	);

	if (!content || content.length === 0) {
		return { from: 0, to: 0 };
	}

	let from = 0;
	let to = content.length;

	// Step 1: Skip YAML frontmatter (not JSON - that's at the end)
	const afterFrontmatter = noteMetadataHelper.stripOnlyFrontmatter(content);
	logger.info(
		"[calculateSmartRange] Step 1 - afterFrontmatter.length:",
		afterFrontmatter.length,
	);
	logger.info(
		"[calculateSmartRange] Step 1 - afterFrontmatter first 300 chars:",
		JSON.stringify(afterFrontmatter.slice(0, 300)),
	);
	if (afterFrontmatter.length < content.length) {
		from = content.length - afterFrontmatter.length;
		logger.info(
			"[calculateSmartRange] Step 1 - frontmatter detected, from =",
			from,
		);
	} else {
		logger.info("[calculateSmartRange] Step 1 - NO frontmatter detected");
	}

	// Step 2: Skip go-back link
	const afterGoBack = goBackLinkHelper.strip(afterFrontmatter);
	logger.info(
		"[calculateSmartRange] Step 2 - afterGoBack.length:",
		afterGoBack.length,
	);
	logger.info(
		"[calculateSmartRange] Step 2 - afterGoBack first 300 chars:",
		JSON.stringify(afterGoBack.slice(0, 300)),
	);
	if (afterGoBack.length < afterFrontmatter.length) {
		const goBackOffset = afterFrontmatter.length - afterGoBack.length;
		from += goBackOffset;
		logger.info(
			"[calculateSmartRange] Step 2 - go-back link detected, offset =",
			goBackOffset,
			"new from =",
			from,
		);
	} else {
		logger.info("[calculateSmartRange] Step 2 - NO go-back link detected");
	}

	// Step 3: Find metadata section start (already excludes preceding whitespace)
	const metaSectionStart = noteMetadataHelper.findSectionStart(content);
	logger.info(
		"[calculateSmartRange] Step 3 - metaSectionStart:",
		metaSectionStart,
	);
	if (metaSectionStart !== null) {
		to = metaSectionStart;
		logger.info("[calculateSmartRange] Step 3 - to =", to);
	}

	// Handle edge case where everything is excluded
	if (from >= to) {
		logger.info(
			"[calculateSmartRange] Edge case: from >= to, returning 0,0",
		);
		return { from: 0, to: 0 };
	}

	logger.info("[calculateSmartRange] === RESULT ===");
	logger.info("[calculateSmartRange] from:", from, "to:", to);
	logger.info(
		"[calculateSmartRange] selected content START (100 chars):",
		JSON.stringify(content.slice(from, from + 100)),
	);
	logger.info(
		"[calculateSmartRange] selected content END (100 chars):",
		JSON.stringify(content.slice(Math.max(from, to - 100), to)),
	);

	return { from, to };
}
