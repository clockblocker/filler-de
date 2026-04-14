import type { EntryBlock, InflectionBlock } from "../model/blocks";
import type { EntryData, NoteData, NoteDocument } from "../model/note";
import type { ParseOptions } from "../model/options";
import {
	inflectionFromSelection,
	inherentFeaturesFromLemma,
	inherentFeaturesFromSelection,
	lemmaToIdentityBlock,
	relationFromLemma,
	relationFromPayload,
	rootToRootMetaBlock,
	selectionToIdentityBlock,
} from "../roots/block-projections";

export function dataToDocument(
	data: NoteData,
	_options?: ParseOptions,
): NoteDocument {
	return {
		entries: data.entries.map((entry) => buildEntryDocumentFromData(entry)),
		meta: data.meta,
	};
}

function buildEntryDocumentFromData(entry: EntryData) {
	const blocks: EntryBlock[] = [];
	blocks.push(
		entry.kind === "lemma"
			? lemmaToIdentityBlock(entry.lemma)
			: selectionToIdentityBlock(entry.selection),
	);

	const rootMeta =
		entry.kind === "lemma"
			? rootToRootMetaBlock(entry.lemma)
			: rootToRootMetaBlock(entry.selection.surface.lemma);
	if (rootMeta) {
		blocks.push(rootMeta);
	}

	if (entry.payload.header) {
		blocks.push({
			block: "header",
			markdown: entry.payload.header.markdown,
		});
	}

	for (const attestation of entry.payload.attestations ?? []) {
		blocks.push({
			block: "attestation",
			markdown: attestation.markdown,
		});
	}

	if (entry.payload.translations) {
		blocks.push({
			block: "translation",
			markdown: entry.payload.translations.markdown,
		});
	}

	const relationBlock =
		entry.kind === "lemma"
			? relationFromLemma(entry.lemma)
			: relationFromPayload(entry.payload.relation);
	if (relationBlock) {
		blocks.push(relationBlock);
	}

	const inherentFeaturesBlock =
		entry.kind === "lemma"
			? inherentFeaturesFromLemma(entry.lemma)
			: inherentFeaturesFromSelection(entry.selection);
	if (inherentFeaturesBlock) {
		blocks.push(inherentFeaturesBlock);
	}

	const inflectionBlock: InflectionBlock | undefined =
		entry.kind === "selection"
			? inflectionFromSelection(entry.selection, entry.payload.inflection)
			: entry.payload.inflection?.rendered
				? {
						block: "inflection",
						rendered: entry.payload.inflection.rendered,
					}
				: undefined;
	if (inflectionBlock) {
		blocks.push(inflectionBlock);
	}

	if (entry.payload.tags) {
		blocks.push({
			block: "tags",
			markdown: entry.payload.tags.markdown,
		});
	}

	for (const freeform of entry.payload.freeform ?? []) {
		blocks.push({
			block: "freeform",
			markdown: freeform.markdown,
		});
	}

	return { blocks };
}
