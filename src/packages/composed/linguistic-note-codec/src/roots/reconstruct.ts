import {
	type AnyLemma,
	LemmaSchema,
	SelectionSchema,
} from "@textfresser/linguistics";

import type { GroupedEntryBlocks } from "../blocks/group-entry-blocks";
import { makeIssue } from "../internal/utils";
import type { IdentityBlock, RootMetaBlock, KnownSelection } from "../model/blocks";
import type { CodecIssue } from "../model/issues";
import type { PartialRootSummary } from "../model/note";

export function buildLemmaRootCandidate(
	identity: Extract<IdentityBlock, { entryKind: "lemma" }>,
	grouped: GroupedEntryBlocks,
	issues: CodecIssue[],
	entryIndex: number,
): Record<string, unknown> {
	const candidate: Record<string, unknown> = {
		language: identity.language,
		lemmaKind: identity.lemmaKind,
		spelledLemma: identity.spelledLemma,
	};

	assignDiscriminator(candidate, identity);
	assignRootMeta(candidate, grouped.rootMeta[0]);

	const relation = grouped.relation[0];
	if (relation) {
		if (relation.lexicalRelations !== undefined) {
			candidate.lexicalRelations = relation.lexicalRelations;
		}
		if (relation.morphologicalRelations !== undefined) {
			candidate.morphologicalRelations = relation.morphologicalRelations;
		}
	}

	const inherentFeatures = grouped.inherentFeatures[0];
	if (inherentFeatures) {
		candidate.inherentFeatures = inherentFeatures.features;
	}

	const inflection = grouped.inflection[0];
	if (inflection?.canonical) {
		issues.push(
			makeIssue(
				"ConflictingBlockPayload",
				'Lemma entries must not carry "inflection.canonical"',
				{
					block: "inflection",
					entryIndex,
				},
			),
		);
	}

	return candidate;
}

export function buildSelectionRootCandidate(
	identity: Extract<IdentityBlock, { entryKind: "selection" }>,
	grouped: GroupedEntryBlocks,
	issues: CodecIssue[],
	entryIndex: number,
): Record<string, unknown> {
	const lemma: Record<string, unknown> = {
		language: identity.language,
		lemmaKind: identity.lemmaKind,
		spelledLemma: identity.spelledLemma,
	};
	assignDiscriminator(lemma, identity);
	assignRootMeta(lemma, grouped.rootMeta[0]);

	const inherentFeatures = grouped.inherentFeatures[0];
	if (inherentFeatures) {
		lemma.inherentFeatures = inherentFeatures.features;
	}

	const surface: Record<string, unknown> = {
		lemma,
		spelledSurface: identity.spelledSurface,
		surfaceKind: identity.surfaceKind,
	};

	const inflection = grouped.inflection[0];
	if (inflection?.canonical) {
		if (identity.surfaceKind === "Inflection") {
			surface.inflectionalFeatures =
				inflection.canonical.inflectionalFeatures;
		} else {
			issues.push(
				makeIssue(
					"ConflictingBlockPayload",
					`Selection surfaceKind "${identity.surfaceKind}" cannot claim canonical inflectional features`,
					{
						block: "inflection",
						entryIndex,
					},
				),
			);
		}
	}

	return {
		language: identity.language,
		orthographicStatus: identity.orthographicStatus,
		surface,
	};
}

export function validateLemma(
	root: Record<string, unknown>,
	identity: Extract<IdentityBlock, { entryKind: "lemma" }>,
):
	| { ok: true; value: AnyLemma }
	| {
			ok: false;
			issue: CodecIssue;
	  } {
	const schema = resolveLemmaSchema(identity);
	if (!schema) {
		return {
			issue: makeIssue(
				"InvalidRootDto",
				"No matching lemma schema exists for this identity",
				{ detail: identity },
			),
			ok: false,
		};
	}

	const result = schema.safeParse(root);
	if (!result.success) {
		return {
			issue: makeIssue(
				"InvalidRootDto",
				"Lemma root failed schema validation",
				{
					detail: result.error.format(),
				},
			),
			ok: false,
		};
	}

	return { ok: true, value: result.data as AnyLemma };
}

export function validateSelection(
	root: Record<string, unknown>,
	identity: Extract<IdentityBlock, { entryKind: "selection" }>,
):
	| { ok: true; value: KnownSelection }
	| {
			ok: false;
			issue: CodecIssue;
	  } {
	const schema = resolveSelectionSchema(identity);
	if (!schema) {
		return {
			issue: makeIssue(
				"InvalidRootDto",
				"No matching selection schema exists for this identity",
				{ detail: identity },
			),
			ok: false,
		};
	}

	const result = schema.safeParse(root);
	if (!result.success) {
		return {
			issue: makeIssue(
				"InvalidRootDto",
				"Selection root failed schema validation",
				{
					detail: result.error.format(),
				},
			),
			ok: false,
		};
	}

	return { ok: true, value: result.data as KnownSelection };
}

export function summarizeIdentity(identity: IdentityBlock): PartialRootSummary {
	return {
		discriminator: getDiscriminatorValue(identity),
		entryKind: identity.entryKind,
		language: identity.language,
		lemmaKind: identity.lemmaKind,
		spelledLemma: identity.spelledLemma,
		spelledSurface:
			identity.entryKind === "selection"
				? identity.spelledSurface
				: undefined,
	};
}

export function getDiscriminatorValue(identity: IdentityBlock): string {
	switch (identity.lemmaKind) {
		case "Lexeme":
			return identity.pos;
		case "Morpheme":
			return identity.morphemeKind;
		case "Phraseme":
			return identity.phrasemeKind;
	}
}

function resolveLemmaSchema(
	identity: Extract<IdentityBlock, { entryKind: "lemma" }>,
): {
	safeParse: (input: unknown) => {
		success: boolean;
		data?: unknown;
		error?: { format: () => unknown };
	};
} | null {
	const languageBranch = (
		LemmaSchema as unknown as Record<
			string,
			Record<string, Record<string, unknown>>
		>
	)[identity.language];
	if (!languageBranch) {
		return null;
	}
	const lemmaKindBranch = languageBranch[identity.lemmaKind];
	if (!lemmaKindBranch) {
		return null;
	}
	return (
		(lemmaKindBranch[
			getDiscriminatorValue(identity)
		] as (typeof languageBranch)[string][string]) ?? null
	);
}

function resolveSelectionSchema(
	identity: Extract<IdentityBlock, { entryKind: "selection" }>,
): {
	safeParse: (input: unknown) => {
		success: boolean;
		data?: unknown;
		error?: { format: () => unknown };
	};
} | null {
	const root = SelectionSchema as unknown as Record<
		string,
		Record<string, Record<string, Record<string, Record<string, unknown>>>>>
	;
	return (
		root[identity.language]?.[identity.orthographicStatus]?.[
			identity.surfaceKind
		]?.[identity.lemmaKind]?.[getDiscriminatorValue(identity)] ?? null
	);
}

function assignDiscriminator(
	target: Record<string, unknown>,
	identity: IdentityBlock,
): void {
	switch (identity.lemmaKind) {
		case "Lexeme":
			target.pos = identity.pos;
			break;
		case "Morpheme":
			target.morphemeKind = identity.morphemeKind;
			break;
		case "Phraseme":
			target.phrasemeKind = identity.phrasemeKind;
			break;
	}
}

function assignRootMeta(
	target: Record<string, unknown>,
	rootMeta: RootMetaBlock | undefined,
): void {
	if (!rootMeta) {
		return;
	}
	if (rootMeta.emojiDescription) {
		target.emojiDescription = [...rootMeta.emojiDescription];
	}
	if (typeof rootMeta.isClosedSet === "boolean") {
		target.isClosedSet = rootMeta.isClosedSet;
	}
	if (typeof rootMeta.separable === "boolean") {
		target.separable = rootMeta.separable;
	}
	if (typeof rootMeta.discourseFormulaRole === "string") {
		target.discourseFormulaRole = rootMeta.discourseFormulaRole;
	}
}
