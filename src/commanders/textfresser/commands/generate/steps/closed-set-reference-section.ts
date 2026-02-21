import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { isClosedSetPos } from "../../../common/lemma-link-routing";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import type { LemmaResult } from "../../lemma/types";

export const CLOSED_SET_REFERENCE_SECTION_KIND = "closed_set_references";
export const CLOSED_SET_REFERENCE_SECTION_TITLE = "Closed-set references";

function resolveClosedSetLibraryTarget(params: {
	lemmaResult: LemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
}): SplitPathToMdFile | null {
	const { lemmaResult } = params;
	if (lemmaResult.linguisticUnit !== "Lexem") {
		return null;
	}
	if (!isClosedSetPos(lemmaResult.posLikeKind)) {
		return null;
	}

	return (
		params
			.lookupInLibrary(lemmaResult.lemma)
			.find((splitPath) => splitPath.pathParts[0] === "Library") ?? null
	);
}

export function buildClosedSetReferenceSection(params: {
	lemmaResult: LemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
}): EntrySection | null {
	const libraryTarget = resolveClosedSetLibraryTarget(params);
	if (!libraryTarget) {
		return null;
	}

	return {
		content: `- [[${libraryTarget.basename}|${params.lemmaResult.lemma} (${params.lemmaResult.posLikeKind})]]`,
		kind: CLOSED_SET_REFERENCE_SECTION_KIND,
		title: CLOSED_SET_REFERENCE_SECTION_TITLE,
	};
}

export function upsertClosedSetReferenceSection(params: {
	entry: DictEntry;
	lemmaResult: LemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
}): void {
	const section = buildClosedSetReferenceSection({
		lemmaResult: params.lemmaResult,
		lookupInLibrary: params.lookupInLibrary,
	});
	if (!section) {
		return;
	}

	const existing = params.entry.sections.find(
		(current) => current.kind === CLOSED_SET_REFERENCE_SECTION_KIND,
	);
	if (!existing) {
		params.entry.sections.push(section);
		return;
	}

	if (existing.content.includes(section.content)) {
		return;
	}

	existing.content = existing.content.trim().length
		? `${existing.content.trimEnd()}\n${section.content}`
		: section.content;
}
