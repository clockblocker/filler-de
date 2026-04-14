import type { AnyLemma } from "@textfresser/linguistics";

import { hasPayloadKeys, isRecord } from "../internal/utils";
import type {
	IdentityBlock,
	InherentFeaturesBlock,
	InflectionBlock,
	InflectionPayload,
	KnownSelection,
	RelationBlock,
	RelationPayload,
	RootMetaBlock,
} from "../model/blocks";

export function lemmaToIdentityBlock(lemma: AnyLemma): IdentityBlock {
	switch (lemma.lemmaKind) {
		case "Lexeme":
			return {
				block: "identity",
				entryKind: "lemma",
				language: lemma.language,
				lemmaKind: "Lexeme",
				pos: lemma.pos,
				spelledLemma: lemma.spelledLemma,
			};
		case "Morpheme":
			return {
				block: "identity",
				entryKind: "lemma",
				language: lemma.language,
				lemmaKind: "Morpheme",
				morphemeKind: lemma.morphemeKind,
				spelledLemma: lemma.spelledLemma,
			};
		case "Phraseme":
			return {
				block: "identity",
				entryKind: "lemma",
				language: lemma.language,
				lemmaKind: "Phraseme",
				phrasemeKind: lemma.phrasemeKind,
				spelledLemma: lemma.spelledLemma,
			};
	}
}

export function selectionToIdentityBlock(
	selection: KnownSelection,
): IdentityBlock {
	const lemma = selection.surface.lemma;
	switch (lemma.lemmaKind) {
		case "Lexeme":
			return {
				block: "identity",
				entryKind: "selection",
				language: selection.language,
				lemmaKind: "Lexeme",
				orthographicStatus: selection.orthographicStatus,
				pos: lemma.pos,
				spelledLemma: lemma.spelledLemma,
				spelledSurface: selection.surface.spelledSurface,
				surfaceKind: selection.surface.surfaceKind,
			};
		case "Morpheme":
			return {
				block: "identity",
				entryKind: "selection",
				language: selection.language,
				lemmaKind: "Morpheme",
				morphemeKind: lemma.morphemeKind,
				orthographicStatus: selection.orthographicStatus,
				spelledLemma: lemma.spelledLemma,
				spelledSurface: selection.surface.spelledSurface,
				surfaceKind: selection.surface.surfaceKind,
			};
		case "Phraseme":
			return {
				block: "identity",
				entryKind: "selection",
				language: selection.language,
				lemmaKind: "Phraseme",
				orthographicStatus: selection.orthographicStatus,
				phrasemeKind: lemma.phrasemeKind,
				spelledLemma: lemma.spelledLemma,
				spelledSurface: selection.surface.spelledSurface,
				surfaceKind: selection.surface.surfaceKind,
			};
	}
}

export function rootToRootMetaBlock(
	root: Record<string, unknown>,
): RootMetaBlock | null {
	const block: RootMetaBlock = { block: "root_meta" };
	if (
		Array.isArray(root.emojiDescription) &&
		root.emojiDescription.length > 0
	) {
		block.emojiDescription = [...(root.emojiDescription as string[])];
	}
	if (typeof root.isClosedSet === "boolean") {
		block.isClosedSet = root.isClosedSet;
	}
	if (typeof root.separable === "boolean") {
		block.separable = root.separable;
	}
	if (typeof root.discourseFormulaRole === "string") {
		block.discourseFormulaRole = root.discourseFormulaRole;
	}

	return hasPayloadKeys(block, [
		"emojiDescription",
		"isClosedSet",
		"separable",
		"discourseFormulaRole",
	])
		? block
		: null;
}

export function relationFromLemma(lemma: AnyLemma): RelationBlock | undefined {
	const record = lemma as Record<string, unknown>;
	if ("lexicalRelations" in record || "morphologicalRelations" in record) {
		return {
			block: "relation",
			lexicalRelations: isRecord(record.lexicalRelations)
				? record.lexicalRelations
				: undefined,
			morphologicalRelations: isRecord(record.morphologicalRelations)
				? record.morphologicalRelations
				: undefined,
		};
	}

	return undefined;
}

export function relationFromPayload(
	relation: RelationPayload | undefined,
): RelationBlock | undefined {
	if (!relation) {
		return undefined;
	}

	return {
		block: "relation",
		lexicalRelations: relation.lexicalRelations,
		morphologicalRelations: relation.morphologicalRelations,
	};
}

export function inherentFeaturesFromLemma(
	lemma: AnyLemma,
): InherentFeaturesBlock | undefined {
	const record = lemma as Record<string, unknown>;
	if (!isRecord(record.inherentFeatures)) {
		return undefined;
	}
	return {
		block: "inherent_features",
		features: record.inherentFeatures,
	};
}

export function inherentFeaturesFromSelection(
	selection: KnownSelection,
): InherentFeaturesBlock | undefined {
	const lemma = selection.surface.lemma as Record<string, unknown>;
	if (!isRecord(lemma.inherentFeatures)) {
		return undefined;
	}
	return {
		block: "inherent_features",
		features: lemma.inherentFeatures,
	};
}

export function inflectionFromSelection(
	selection: KnownSelection,
	payloadInflection: InflectionPayload | undefined,
): InflectionBlock | undefined {
	const block: InflectionBlock = { block: "inflection" };
	if (
		selection.surface.surfaceKind === "Inflection" &&
		isRecord(selection.surface.inflectionalFeatures)
	) {
		block.canonical = {
			inflectionalFeatures: selection.surface.inflectionalFeatures,
		};
	}
	if (payloadInflection?.rendered) {
		block.rendered = payloadInflection.rendered;
	}

	return block.canonical || block.rendered ? block : undefined;
}
