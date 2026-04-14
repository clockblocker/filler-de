import { mergeSingletonBlocks } from "../blocks/merge-singleton-blocks";
import { CANONICAL_BLOCK_ORDER } from "../internal/constants";
import { makeIssue, stableStringify, stripSource } from "../internal/utils";
import type {
	AttestationBlock,
	EntryBlock,
	FreeformBlock,
	StructuredRawBlock,
} from "../model/blocks";
import type { CodecIssue } from "../model/issues";
import type { NoteDocument, EntryDocument } from "../model/note";
import type { ParseOptions } from "../model/options";

export function normalizeDocument(
	document: NoteDocument,
	_options?: ParseOptions,
): {
	document: NoteDocument;
	issues: CodecIssue[];
} {
	const issues: CodecIssue[] = [];
	const entries = document.entries.map((entry, entryIndex) =>
		normalizeEntryDocument(entry, entryIndex, issues),
	);

	return {
		document: {
			entries,
			meta: document.meta,
		},
		issues,
	};
}

function normalizeEntryDocument(
	entry: EntryDocument,
	entryIndex: number,
	issues: CodecIssue[],
): EntryDocument {
	const merged: EntryBlock[] = [];
	const singletonBlocks = new Map<string, EntryBlock>();
	const attestationBlocks: AttestationBlock[] = [];
	const freeformBlocks: FreeformBlock[] = [];
	const structuredRawBlocks: StructuredRawBlock[] = [];
	let encounteredOrderChanged = false;

	for (const block of entry.blocks) {
		if (block.block === "attestation") {
			attestationBlocks.push(stripSource(block));
			continue;
		}

		if (block.block === "freeform") {
			freeformBlocks.push(stripSource(block));
			continue;
		}

		if (block.block === "structured_raw") {
			structuredRawBlocks.push(stripSource(block));
			continue;
		}

		if (singletonBlocks.has(block.block)) {
			const current = singletonBlocks.get(block.block) as EntryBlock;
			singletonBlocks.set(
				block.block,
				mergeSingletonBlocks(current, block, entryIndex, issues),
			);
			issues.push(
				makeIssue(
					"SemanticBlockMerged",
					`Merged duplicate "${block.block}" blocks during normalization`,
					{
						block: block.block,
						entryIndex,
					},
				),
			);
			continue;
		}

		singletonBlocks.set(block.block, stripSource(block));
	}

	for (const blockId of CANONICAL_BLOCK_ORDER) {
		if (blockId === "attestation") {
			merged.push(...attestationBlocks);
			continue;
		}
		if (blockId === "structured_raw") {
			merged.push(...structuredRawBlocks);
			continue;
		}
		if (blockId === "freeform") {
			merged.push(...freeformBlocks);
			continue;
		}

		const singleton = singletonBlocks.get(blockId);
		if (singleton) {
			merged.push(singleton);
		}
	}

	const originalOrder = entry.blocks
		.map((block) => block.block)
		.filter((block) => block !== "freeform" && block !== "structured_raw");
	const normalizedOrder = merged
		.map((block) => block.block)
		.filter((block) => block !== "freeform" && block !== "structured_raw");
	if (stableStringify(originalOrder) !== stableStringify(normalizedOrder)) {
		encounteredOrderChanged = true;
	}

	if (encounteredOrderChanged) {
		issues.push(
			makeIssue(
				"OrderingNormalized",
				"Entry block ordering was normalized",
				{
					entryIndex,
				},
			),
		);
	}

	return {
		blocks: merged,
	};
}
