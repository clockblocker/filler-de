import { markdownHelper } from "../../../../stateless-helpers/markdown-strip";
import { multiSpanHelper } from "../../../../stateless-helpers/multi-span";
import { wikilinkHelper } from "../../../../stateless-helpers/wikilink";
import { logger } from "../../../../utils/logger";
import {
	buildWikilinkForTarget,
	expandOffsetForLinkedSpan,
	hasNestedWikilinkStructure,
} from "../../commands/lemma/lemma-command";
import type { Attestation } from "../../common/attestation/types";

export type RewritePlan = {
	updatedBlock: string;
	wikilink: string;
	replaceOffsetInBlock?: number;
	replaceSurface?: string;
};

export function buildUpdatedBlock(
	rawBlock: string,
	offset: number | undefined,
	surface: string,
	wikilink: string,
): string {
	if (offset === undefined) {
		return rawBlock.replace(surface, wikilink);
	}

	return (
		rawBlock.slice(0, offset) +
		wikilink +
		rawBlock.slice(offset + surface.length)
	);
}

export function buildLemmaRewritePlan(params: {
	attestation: Attestation;
	contextWithLinkedParts?: string;
	linkTarget: string;
}): RewritePlan {
	const { attestation, contextWithLinkedParts, linkTarget } = params;
	const rawBlock = attestation.source.textRaw;
	const surface = attestation.target.surface;
	const offset = attestation.target.offsetInBlock;

	let updatedBlock: string | null = null;
	let replaceSurface = surface;
	let replaceOffsetInBlock = offset ?? undefined;
	const enclosingWikilink =
		offset !== undefined
			? wikilinkHelper.findEnclosingByOffset(rawBlock, offset)
			: null;
	const linkedTarget =
		enclosingWikilink?.surface === surface
			? enclosingWikilink.target
			: (attestation.target.lemma ??
				wikilinkHelper.findBySurface(rawBlock, surface)?.target ??
				null);

	if (linkedTarget === linkTarget) {
		return {
			replaceOffsetInBlock,
			replaceSurface,
			updatedBlock: rawBlock,
			wikilink: buildWikilinkForTarget(replaceSurface, linkTarget),
		};
	}

	if (contextWithLinkedParts && offset !== undefined) {
		const stripped = multiSpanHelper.stripBrackets(contextWithLinkedParts);
		const expectedStripped = markdownHelper.stripAll(rawBlock);

		if (stripped === expectedStripped) {
			const spans = multiSpanHelper.parseBracketedSpans(
				contextWithLinkedParts,
			);

			if (spans.length > 1) {
				const resolved = multiSpanHelper.mapSpansToRawBlock(
					rawBlock,
					spans,
					surface,
					offset,
				);
				if (resolved && resolved.length > 1) {
					updatedBlock = multiSpanHelper.applyMultiSpanReplacement(
						rawBlock,
						resolved,
						linkTarget,
					);
					attestation.source.textWithOnlyTargetMarked =
						contextWithLinkedParts;
				}
			}

			if (updatedBlock === null && spans.length === 1) {
				const span = spans[0];
				if (span && span.text !== surface) {
					const expanded = expandOffsetForLinkedSpan(
						rawBlock,
						surface,
						offset,
						span.text,
					);
					if (expanded.replaceSurface !== surface) {
						replaceSurface = expanded.replaceSurface;
						replaceOffsetInBlock = expanded.replaceOffset;
						updatedBlock = buildUpdatedBlock(
							rawBlock,
							expanded.replaceOffset,
							expanded.replaceSurface,
							buildWikilinkForTarget(
								expanded.replaceSurface,
								linkTarget,
							),
						);
						attestation.source.textWithOnlyTargetMarked =
							contextWithLinkedParts;
					}
				}
			}
		} else {
			logger.warn(
				"[lemma] contextWithLinkedParts stripped text mismatch — falling back to single-span",
			);
		}
	}

	const wikilink = buildWikilinkForTarget(replaceSurface, linkTarget);
	const resolvedUpdatedBlock =
		updatedBlock ??
		buildUpdatedBlock(
			rawBlock,
			replaceOffsetInBlock,
			replaceSurface,
			wikilink,
		);

	if (hasNestedWikilinkStructure(resolvedUpdatedBlock)) {
		logger.warn(
			"[lemma] nested wikilink rewrite plan detected — keeping source unchanged",
		);
		return {
			replaceOffsetInBlock,
			replaceSurface,
			updatedBlock: rawBlock,
			wikilink,
		};
	}

	return {
		replaceOffsetInBlock,
		replaceSurface,
		updatedBlock: resolvedUpdatedBlock,
		wikilink,
	};
}
