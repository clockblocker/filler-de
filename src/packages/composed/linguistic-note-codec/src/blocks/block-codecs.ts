import type {
	AttestationBlock,
	HeaderBlock,
	IdentityBlock,
	InherentFeaturesBlock,
	InflectionBlock,
	RelationBlock,
	RootMetaBlock,
	TagsBlock,
	TranslationBlock,
} from "../model/blocks";
import {
	type MorphemeKind,
	type OrthographicStatus,
	type PhrasemeKind,
	type Pos,
	type SurfaceKind,
	type TargetLanguage,
} from "@textfresser/linguistics";
import { asString, isRecord } from "../internal/utils";

export function makeTextBlock(
	blockId: string,
	markdown: string,
	sourceMarkdown: string,
): HeaderBlock | TagsBlock | TranslationBlock | AttestationBlock {
	switch (blockId) {
		case "header":
			return { block: "header", markdown, sourceMarkdown };
		case "tags":
			return { block: "tags", markdown, sourceMarkdown };
		case "translation":
			return { block: "translation", markdown, sourceMarkdown };
		case "attestation":
			return { block: "attestation", markdown, sourceMarkdown };
		default:
			throw new Error(`Unsupported text block ${blockId}`);
	}
}

export function parseKnownJsonBlock(
	blockId: string,
	payload: unknown,
	sourceMarkdown: string,
):
	| IdentityBlock
	| RootMetaBlock
	| RelationBlock
	| InherentFeaturesBlock
	| InflectionBlock
	| null {
	switch (blockId) {
		case "identity":
			return parseIdentityPayload(payload, sourceMarkdown);
		case "root_meta":
			return parseRootMetaPayload(payload, sourceMarkdown);
		case "relation":
			return parseRelationPayload(payload, sourceMarkdown);
		case "inherent_features":
			return parseInherentFeaturesPayload(payload, sourceMarkdown);
		case "inflection":
			return parseInflectionPayload(payload, sourceMarkdown);
		default:
			return null;
	}
}

function parseIdentityPayload(
	payload: unknown,
	sourceMarkdown: string,
): IdentityBlock | null {
	if (!isRecord(payload)) {
		return null;
	}

	const entryKind = asString(payload.entryKind);
	const language = asString(payload.language);
	const lemmaKind = asString(payload.lemmaKind);
	const spelledLemma = asString(payload.spelledLemma);
	if (!entryKind || !language || !lemmaKind || !spelledLemma) {
		return null;
	}

	if (entryKind === "lemma") {
		if (lemmaKind === "Lexeme") {
			const pos = asString(payload.pos);
			if (!pos) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "lemma",
				language: language as TargetLanguage,
				lemmaKind: "Lexeme",
				pos: pos as Pos,
				sourceMarkdown,
				spelledLemma,
			};
		}
		if (lemmaKind === "Morpheme") {
			const morphemeKind = asString(payload.morphemeKind);
			if (!morphemeKind) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "lemma",
				language: language as TargetLanguage,
				lemmaKind: "Morpheme",
				morphemeKind: morphemeKind as MorphemeKind,
				sourceMarkdown,
				spelledLemma,
			};
		}
		if (lemmaKind === "Phraseme") {
			const phrasemeKind = asString(payload.phrasemeKind);
			if (!phrasemeKind) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "lemma",
				language: language as TargetLanguage,
				lemmaKind: "Phraseme",
				phrasemeKind: phrasemeKind as PhrasemeKind,
				sourceMarkdown,
				spelledLemma,
			};
		}
		return null;
	}

	if (entryKind === "selection") {
		const orthographicStatus = asString(payload.orthographicStatus);
		const surfaceKind = asString(payload.surfaceKind);
		const spelledSurface = asString(payload.spelledSurface);
		if (!orthographicStatus || !surfaceKind || !spelledSurface) {
			return null;
		}

		if (lemmaKind === "Lexeme") {
			const pos = asString(payload.pos);
			if (!pos) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "selection",
				language: language as TargetLanguage,
				lemmaKind: "Lexeme",
				orthographicStatus: orthographicStatus as OrthographicStatus,
				pos: pos as Pos,
				sourceMarkdown,
				spelledLemma,
				spelledSurface,
				surfaceKind: surfaceKind as SurfaceKind,
			};
		}
		if (lemmaKind === "Morpheme") {
			const morphemeKind = asString(payload.morphemeKind);
			if (!morphemeKind) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "selection",
				language: language as TargetLanguage,
				lemmaKind: "Morpheme",
				morphemeKind: morphemeKind as MorphemeKind,
				orthographicStatus: orthographicStatus as OrthographicStatus,
				sourceMarkdown,
				spelledLemma,
				spelledSurface,
				surfaceKind: surfaceKind as SurfaceKind,
			};
		}
		if (lemmaKind === "Phraseme") {
			const phrasemeKind = asString(payload.phrasemeKind);
			if (!phrasemeKind) {
				return null;
			}
			return {
				block: "identity",
				entryKind: "selection",
				language: language as TargetLanguage,
				lemmaKind: "Phraseme",
				orthographicStatus: orthographicStatus as OrthographicStatus,
				phrasemeKind: phrasemeKind as PhrasemeKind,
				sourceMarkdown,
				spelledLemma,
				spelledSurface,
				surfaceKind: surfaceKind as SurfaceKind,
			};
		}
	}

	return null;
}

function parseRootMetaPayload(
	payload: unknown,
	sourceMarkdown: string,
): RootMetaBlock | null {
	if (!isRecord(payload)) {
		return null;
	}

	const emojiDescription = payload.emojiDescription;
	if (
		emojiDescription !== undefined &&
		(!Array.isArray(emojiDescription) ||
			emojiDescription.some((emoji) => typeof emoji !== "string"))
	) {
		return null;
	}

	const isClosedSet = payload.isClosedSet;
	if (isClosedSet !== undefined && typeof isClosedSet !== "boolean") {
		return null;
	}

	const separable = payload.separable;
	if (separable !== undefined && typeof separable !== "boolean") {
		return null;
	}

	const discourseFormulaRole = payload.discourseFormulaRole;
	if (
		discourseFormulaRole !== undefined &&
		typeof discourseFormulaRole !== "string"
	) {
		return null;
	}

	return {
		block: "root_meta",
		discourseFormulaRole:
			typeof discourseFormulaRole === "string"
				? discourseFormulaRole
				: undefined,
		emojiDescription: Array.isArray(emojiDescription)
			? [...emojiDescription]
			: undefined,
		isClosedSet: typeof isClosedSet === "boolean" ? isClosedSet : undefined,
		separable: typeof separable === "boolean" ? separable : undefined,
		sourceMarkdown,
	};
}

function parseRelationPayload(
	payload: unknown,
	sourceMarkdown: string,
): RelationBlock | null {
	if (!isRecord(payload)) {
		return null;
	}

	if (
		(payload.lexicalRelations !== undefined &&
			!isRecord(payload.lexicalRelations)) ||
		(payload.morphologicalRelations !== undefined &&
			!isRecord(payload.morphologicalRelations))
	) {
		return null;
	}

	return {
		block: "relation",
		lexicalRelations: isRecord(payload.lexicalRelations)
			? payload.lexicalRelations
			: undefined,
		morphologicalRelations: isRecord(payload.morphologicalRelations)
			? payload.morphologicalRelations
			: undefined,
		sourceMarkdown,
	};
}

function parseInherentFeaturesPayload(
	payload: unknown,
	sourceMarkdown: string,
): InherentFeaturesBlock | null {
	if (!isRecord(payload) || !isRecord(payload.features)) {
		return null;
	}

	return {
		block: "inherent_features",
		features: payload.features,
		sourceMarkdown,
	};
}

function parseInflectionPayload(
	payload: unknown,
	sourceMarkdown: string,
): InflectionBlock | null {
	if (!isRecord(payload)) {
		return null;
	}

	const canonical = payload.canonical;
	if (
		canonical !== undefined &&
		(!isRecord(canonical) || !isRecord(canonical.inflectionalFeatures))
	) {
		return null;
	}

	const rendered = payload.rendered;
	if (
		rendered !== undefined &&
		(!isRecord(rendered) || !Array.isArray(rendered.rows))
	) {
		return null;
	}

	return {
		block: "inflection",
		canonical: isRecord(canonical)
			? {
					inflectionalFeatures:
						canonical.inflectionalFeatures as Record<
							string,
							unknown
						>,
				}
			: undefined,
		rendered: isRecord(rendered)
			? {
					rows: rendered.rows as unknown[],
				}
			: undefined,
		sourceMarkdown,
	};
}
