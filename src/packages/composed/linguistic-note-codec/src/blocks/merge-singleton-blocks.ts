import type { EntryBlock } from "../model/blocks";
import type { CodecIssue } from "../model/issues";
import {
	coalesceValue,
	dedupeArray,
	joinMarkdown,
	makeIssue,
	mergeStringArrays,
	mergeUnknownRecords,
	stableStringify,
	stripSource,
} from "../internal/utils";

export function mergeSingletonBlocks(
	current: EntryBlock,
	incoming: EntryBlock,
	entryIndex: number,
	issues: CodecIssue[],
): EntryBlock {
	if (current.block !== incoming.block) {
		return current;
	}

	switch (current.block) {
		case "identity":
			if (
				stableStringify(stripSource(current)) !==
				stableStringify(stripSource(incoming))
			) {
				issues.push(
					makeIssue(
						"ConflictingBlockPayload",
						'Conflicting "identity" blocks could not be reconciled cleanly',
						{
							block: "identity",
							entryIndex,
						},
					),
				);
			}
			return stripSource(current);
		case "root_meta":
			return {
				block: "root_meta",
				discourseFormulaRole:
					typeof incoming.discourseFormulaRole === "string"
						? incoming.discourseFormulaRole
						: current.discourseFormulaRole,
				emojiDescription: mergeStringArrays(
					current.emojiDescription,
					incoming.emojiDescription,
				),
				isClosedSet: coalesceValue(
					current.isClosedSet,
					incoming.isClosedSet,
				),
				separable: coalesceValue(current.separable, incoming.separable),
			};
		case "relation":
			return {
				block: "relation",
				lexicalRelations: mergeUnknownRecords(
					current.lexicalRelations,
					incoming.lexicalRelations,
				),
				morphologicalRelations: mergeUnknownRecords(
					current.morphologicalRelations,
					incoming.morphologicalRelations,
				),
			};
		case "inherent_features":
			return {
				block: "inherent_features",
				features:
					mergeUnknownRecords(current.features, incoming.features) ??
					{},
			};
		case "inflection":
			return {
				block: "inflection",
				canonical:
					current.canonical || incoming.canonical
						? {
								inflectionalFeatures:
									mergeUnknownRecords(
										current.canonical?.inflectionalFeatures,
										incoming.canonical
											?.inflectionalFeatures,
									) ?? {},
							}
						: undefined,
				rendered:
					current.rendered || incoming.rendered
						? {
								rows: dedupeArray([
									...(current.rendered?.rows ?? []),
									...(incoming.rendered?.rows ?? []),
								]),
							}
						: undefined,
			};
		case "header":
		case "tags":
		case "translation":
		case "attestation":
			return {
				block: current.block,
				markdown: joinMarkdown(current.markdown, incoming.markdown),
			} as EntryBlock;
		case "freeform":
		case "structured_raw":
			return current;
	}
}
