import type { LexicalInfo } from "@textfresser/lexical-generation";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { DictEntry } from "../../../domain/dict-note/types";
import { getSectionsFor } from "../../../targets/de/sections/section-config";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import type { DictSectionKind } from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import { buildSectionQuery, V3_SECTIONS } from "./section-generation-context";

export function resolveExpectedV3SectionKinds(params: {
	lexicalInfo: LexicalInfo;
}): DictSectionKind[] {
	return getSectionsFor(buildSectionQuery(params.lexicalInfo)).filter(
		(sectionKind) => V3_SECTIONS.has(sectionKind),
	);
}

export function resolveExpectedV3SectionKindsFromLemmaResult(params: {
	lemmaResult: LemmaResult;
}): DictSectionKind[] {
	const { lemmaResult } = params;
	return getSectionsFor(
		lemmaResult.linguisticUnit === "Lexem"
			? {
					pos: lemmaResult.posLikeKind,
					unit: "Lexem",
				}
			: { unit: "Phrasem" },
	).filter((sectionKind) => V3_SECTIONS.has(sectionKind));
}

export function computeMissingV3SectionKinds(params: {
	entry: DictEntry;
	lexicalInfo: LexicalInfo;
}): DictSectionKind[] {
	const expectedKinds = resolveExpectedV3SectionKinds(params);
	const existingKinds = new Set(params.entry.sections.map((s) => s.kind));
	return expectedKinds.filter(
		(sectionKind) => !existingKinds.has(cssSuffixFor[sectionKind]),
	);
}

export function computeMissingV3SectionKindsFromLemmaResult(params: {
	entry: DictEntry;
	lemmaResult: LemmaResult;
}): DictSectionKind[] {
	const expectedKinds = resolveExpectedV3SectionKindsFromLemmaResult(params);
	const existingKinds = new Set(params.entry.sections.map((s) => s.kind));
	return expectedKinds.filter(
		(sectionKind) => !existingKinds.has(cssSuffixFor[sectionKind]),
	);
}

export function findEntryForLemmaResult(params: {
	entries: DictEntry[];
	generatedEntryId?: string;
	lemmaResult: LemmaResult;
}): DictEntry | null {
	const { entries, generatedEntryId, lemmaResult } = params;

	if (generatedEntryId) {
		const exact = entries.find((entry) => entry.id === generatedEntryId);
		if (exact) return exact;
	}

	const disambiguation = lemmaResult.disambiguationResult;
	if (!disambiguation) return null;

	return (
		entries.find((entry) => {
			const parsed = dictEntryIdHelper.parse(entry.id);
			if (!parsed) return false;
			if (parsed.index !== disambiguation.matchedIndex) return false;
			if (parsed.unitKind !== lemmaResult.linguisticUnit) return false;
			if (
				lemmaResult.linguisticUnit === "Lexem" &&
				parsed.pos !== lemmaResult.posLikeKind
			) {
				return false;
			}
			return true;
		}) ?? null
	);
}
