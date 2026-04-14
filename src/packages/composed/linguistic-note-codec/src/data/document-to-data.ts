import { groupEntryBlocks } from "../blocks/group-entry-blocks";
import { SINGLETON_BLOCK_IDS } from "../internal/constants";
import { compactObject, makeIssue } from "../internal/utils";
import {
	buildLemmaRootCandidate,
	buildSelectionRootCandidate,
	summarizeIdentity,
	validateLemma,
	validateSelection,
} from "../roots/reconstruct";
import type { IdentityBlock } from "../model/blocks";
import {
	LinguisticNoteCodecError,
	type CodecIssue,
} from "../model/issues";
import type {
	EntryData,
	EntryDocument,
	EntryPayload,
	NoteDocument,
	PartialEntryData,
	PartialNoteData,
} from "../model/note";
import type { ParseOptions } from "../model/options";

export function documentToDataStrict(
	document: NoteDocument,
	_options?: ParseOptions,
): {
	entries: EntryData[];
	meta?: Record<string, unknown>;
} {
	const result = documentToDataInternal(document, true);
	if (result.issues.length > 0) {
		throw new LinguisticNoteCodecError(
			result.issues[0]?.message ?? "Failed to reconstruct note data",
			result.issues,
		);
	}
	return result.data as {
		entries: EntryData[];
		meta?: Record<string, unknown>;
	};
}

export function documentToDataLoose(
	document: NoteDocument,
	_options?: ParseOptions,
): {
	data: PartialNoteData;
	issues: CodecIssue[];
} {
	return documentToDataInternal(document, false);
}

function documentToDataInternal(
	document: NoteDocument,
	strict: boolean,
): { data: PartialNoteData; issues: CodecIssue[] } {
	const issues: CodecIssue[] = [];
	const entries = document.entries.map((entry, entryIndex) => {
		const entryIssues: CodecIssue[] = [];
		const grouped = groupEntryBlocks(entry.blocks);

		for (const rawBlock of grouped.structuredRaw) {
			entryIssues.push(
				makeIssue(
					rawBlock.reason === "unknown"
						? "UnknownTypedBlock"
						: "UnclaimedStructuredBlock",
					rawBlock.reason === "unknown"
						? `Structured block "${rawBlock.blockId}" is not supported`
						: `Structured block "${rawBlock.blockId}" could not be claimed`,
					{
						blockId: rawBlock.blockId,
						entryIndex,
					},
				),
			);
		}

		for (const blockId of SINGLETON_BLOCK_IDS) {
			const count = grouped.byBlockId.get(blockId)?.length ?? 0;
			if (count > 1) {
				entryIssues.push(
					makeIssue(
						"DuplicateBlock",
						`Entry contains duplicate "${blockId}" blocks`,
						{
							block: blockId,
							entryIndex,
						},
					),
				);
			}
		}

		const identity = grouped.identity[0];
		if (!identity) {
			entryIssues.push(
				makeIssue(
					"MissingRequiredBlock",
					'Entry is missing "identity"',
					{
						block: "identity",
						entryIndex,
					},
				),
			);
			issues.push(...entryIssues);
			if (strict) {
				throw new LinguisticNoteCodecError(
					entryIssues[0]?.message ?? 'Entry is missing "identity"',
					entryIssues,
				);
			}
			return buildInvalidEntry(entry);
		}

		const payload = extractEntryPayload(grouped);
		const duplicateCriticalBlocks = entryIssues.some(
			(issue) => issue.code === "DuplicateBlock",
		);
		if (duplicateCriticalBlocks) {
			issues.push(...entryIssues);
			if (strict) {
				throw new LinguisticNoteCodecError(
					entryIssues[0]?.message ??
						"Duplicate semantic blocks are not allowed",
					entryIssues,
				);
			}
			return buildInvalidEntry(entry, identity, payload);
		}

		let dataEntry: EntryData | null = null;
		if (identity.entryKind === "lemma") {
			const rootIssues: CodecIssue[] = [];
			const root = buildLemmaRootCandidate(
				identity,
				grouped,
				rootIssues,
				entryIndex,
			);
			if (rootIssues.length === 0) {
				const validated = validateLemma(root, identity);
				if (validated.ok) {
					dataEntry = {
						kind: "lemma",
						lemma: validated.value,
						payload,
					};
				} else {
					rootIssues.push(validated.issue);
				}
			}
			if (rootIssues.length > 0) {
				entryIssues.push(...rootIssues);
			}
		} else {
			const rootIssues: CodecIssue[] = [];
			const root = buildSelectionRootCandidate(
				identity,
				grouped,
				rootIssues,
				entryIndex,
			);
			if (rootIssues.length === 0) {
				const validated = validateSelection(root, identity);
				if (validated.ok) {
					dataEntry = {
						kind: "selection",
						payload,
						selection: validated.value,
					};
				} else {
					rootIssues.push(validated.issue);
				}
			}
			if (rootIssues.length > 0) {
				entryIssues.push(...rootIssues);
			}
		}

		issues.push(...entryIssues);
		if (dataEntry) {
			return dataEntry;
		}

		if (strict) {
			throw new LinguisticNoteCodecError(
				entryIssues[0]?.message ?? "Failed to validate entry",
				entryIssues,
			);
		}

		return buildInvalidEntry(entry, identity, payload);
	});

	return {
		data: {
			entries,
			meta: document.meta,
		},
		issues,
	};
}

function extractEntryPayload(
	grouped: ReturnType<typeof groupEntryBlocks>,
): EntryPayload {
	return compactObject({
		attestations: grouped.attestation.map((block) => ({
			markdown: block.markdown,
		})),
		freeform: grouped.freeform.map((block) => ({
			markdown: block.markdown,
		})),
		header: grouped.header[0]
			? {
					markdown: grouped.header[0].markdown,
				}
			: undefined,
		inflection: grouped.inflection[0]
			? {
					canonical: grouped.inflection[0].canonical,
					rendered: grouped.inflection[0].rendered,
				}
			: undefined,
		inherentFeatures: grouped.inherentFeatures[0]
			? {
					features: grouped.inherentFeatures[0].features,
				}
			: undefined,
		relation: grouped.relation[0]
			? {
					lexicalRelations: grouped.relation[0].lexicalRelations,
					morphologicalRelations:
						grouped.relation[0].morphologicalRelations,
				}
			: undefined,
		tags: grouped.tags[0]
			? {
					markdown: grouped.tags[0].markdown,
				}
			: undefined,
		translations: grouped.translation[0]
			? {
					markdown: grouped.translation[0].markdown,
				}
			: undefined,
	});
}

function buildInvalidEntry(
	entry: EntryDocument,
	identity?: IdentityBlock,
	payload?: EntryPayload,
): Extract<PartialEntryData, { kind: "invalid" }> {
	return {
		blocks: entry.blocks,
		kind: "invalid",
		partialPayload: payload,
		partialRoot: identity ? summarizeIdentity(identity) : undefined,
		reconstructionTarget: identity?.entryKind ?? "unknown",
	};
}
