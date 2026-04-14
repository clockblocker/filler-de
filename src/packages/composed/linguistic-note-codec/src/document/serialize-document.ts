import { stableStringify, stripSource } from "../internal/utils";
import type { EntryBlock } from "../model/blocks";
import type { EntryDocument, NoteDocument } from "../model/note";
import type { SerializeOptions } from "../model/options";

export function serializeDocument(
	document: NoteDocument,
	options: SerializeOptions = {},
): string {
	return document.entries
		.map((entry) => serializeEntryDocument(entry, options))
		.join("");
}

function serializeEntryDocument(
	entry: EntryDocument,
	options: SerializeOptions,
): string {
	if (options.useSourceMarkdown !== false && entry.sourceMarkdown) {
		return entry.sourceMarkdown.endsWith("\n")
			? entry.sourceMarkdown
			: `${entry.sourceMarkdown}\n`;
	}

	const body = entry.blocks
		.map((block) => serializeBlock(block, options))
		.join("\n")
		.replace(/\n*$/u, "\n");
	return `:::entry\n${body}:::\n`;
}

function serializeBlock(block: EntryBlock, options: SerializeOptions): string {
	if (options.useSourceMarkdown !== false && block.sourceMarkdown) {
		return block.sourceMarkdown.endsWith("\n")
			? block.sourceMarkdown
			: `${block.sourceMarkdown}\n`;
	}

	switch (block.block) {
		case "freeform":
			return block.markdown.endsWith("\n")
				? block.markdown
				: `${block.markdown}\n`;
		case "structured_raw":
			return `:::${block.blockId}\n${block.markdown}${block.markdown.endsWith("\n") ? "" : "\n"}:::\n`;
		case "header":
		case "tags":
		case "translation":
		case "attestation":
			return `:::${block.block}\n${block.markdown}${block.markdown.endsWith("\n") ? "" : "\n"}:::\n`;
		case "identity":
			return serializeJsonBlock(block.block, stripSource(block));
		case "root_meta":
			return serializeJsonBlock(block.block, stripSource(block));
		case "relation":
			return serializeJsonBlock(block.block, {
				lexicalRelations: block.lexicalRelations,
				morphologicalRelations: block.morphologicalRelations,
			});
		case "inherent_features":
			return serializeJsonBlock(block.block, {
				features: block.features,
			});
		case "inflection":
			return serializeJsonBlock(block.block, {
				canonical: block.canonical,
				rendered: block.rendered,
			});
	}
}

function serializeJsonBlock(blockId: string, payload: unknown): string {
	return `:::${blockId}\n${stableStringify(payload)}\n:::\n`;
}
