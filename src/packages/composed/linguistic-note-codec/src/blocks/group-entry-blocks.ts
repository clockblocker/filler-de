import type {
	AttestationBlock,
	EntryBlock,
	FreeformBlock,
	HeaderBlock,
	IdentityBlock,
	InherentFeaturesBlock,
	InflectionBlock,
	RelationBlock,
	RootMetaBlock,
	StructuredRawBlock,
	TagsBlock,
	TranslationBlock,
} from "../model/blocks";
import { pushByBlockId } from "../internal/utils";

export type GroupedEntryBlocks = {
	attestation: AttestationBlock[];
	byBlockId: Map<string, EntryBlock[]>;
	freeform: FreeformBlock[];
	header: HeaderBlock[];
	identity: IdentityBlock[];
	inflection: InflectionBlock[];
	inherentFeatures: InherentFeaturesBlock[];
	relation: RelationBlock[];
	rootMeta: RootMetaBlock[];
	structuredRaw: StructuredRawBlock[];
	tags: TagsBlock[];
	translation: TranslationBlock[];
};

export function groupEntryBlocks(blocks: EntryBlock[]): GroupedEntryBlocks {
	const grouped: GroupedEntryBlocks = {
		attestation: [],
		byBlockId: new Map(),
		freeform: [],
		header: [],
		identity: [],
		inflection: [],
		inherentFeatures: [],
		relation: [],
		rootMeta: [],
		structuredRaw: [],
		tags: [],
		translation: [],
	};

	for (const block of blocks) {
		switch (block.block) {
			case "identity":
				grouped.identity.push(block);
				pushByBlockId(grouped.byBlockId, "identity", block);
				break;
			case "root_meta":
				grouped.rootMeta.push(block);
				pushByBlockId(grouped.byBlockId, "root_meta", block);
				break;
			case "relation":
				grouped.relation.push(block);
				pushByBlockId(grouped.byBlockId, "relation", block);
				break;
			case "inherent_features":
				grouped.inherentFeatures.push(block);
				pushByBlockId(grouped.byBlockId, "inherent_features", block);
				break;
			case "inflection":
				grouped.inflection.push(block);
				pushByBlockId(grouped.byBlockId, "inflection", block);
				break;
			case "header":
				grouped.header.push(block);
				pushByBlockId(grouped.byBlockId, "header", block);
				break;
			case "tags":
				grouped.tags.push(block);
				pushByBlockId(grouped.byBlockId, "tags", block);
				break;
			case "translation":
				grouped.translation.push(block);
				pushByBlockId(grouped.byBlockId, "translation", block);
				break;
			case "attestation":
				grouped.attestation.push(block);
				pushByBlockId(grouped.byBlockId, "attestation", block);
				break;
			case "freeform":
				grouped.freeform.push(block);
				break;
			case "structured_raw":
				grouped.structuredRaw.push(block);
				break;
		}
	}

	return grouped;
}
