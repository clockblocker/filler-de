import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";
import type { TargetLanguage } from "../../../../../types";
import { resolveClosedSetLibraryTarget } from "../../../common/closed-set-library-target-resolver";
import { isClosedSetPos } from "../../../common/lemma-link-routing";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";

const CLOSED_SET_MEMBERSHIP_SECTION_KIND = "closed_set_membership";
const CLOSED_SET_MEMBERSHIP_SECTION_TITLE = "Closed-set membership";
const CLOSED_SET_TAG = "#kind/closed-set";

type ClosedSetLexemLemmaResult = Extract<
	LemmaResult,
	{ linguisticUnit: "Lexem" }
>;

type EnsureMembershipParams = {
	existingEntries: DictEntry[];
	lemmaResult: ClosedSetLexemLemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
	targetLanguage: TargetLanguage;
};

type EnsureMembershipResult = {
	entries: DictEntry[];
	entry: DictEntry;
};

function resolveClosedSetLibraryTargetForLemma(params: {
	lemmaResult: ClosedSetLexemLemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
	targetLanguage: TargetLanguage;
}): SplitPathToMdFile | null {
	const { lemmaResult } = params;
	if (!isClosedSetPos(lemmaResult.posLikeKind)) {
		return null;
	}

	return resolveClosedSetLibraryTarget({
		candidates: params.lookupInLibrary(lemmaResult.lemma),
		posLikeKind: lemmaResult.posLikeKind,
		targetLanguage: params.targetLanguage,
	});
}

function buildMembershipSection(params: {
	libraryBasename: string;
	lemma: string;
	pos: ClosedSetLexemLemmaResult["posLikeKind"];
}): EntrySection {
	return {
		content: `- [[${params.libraryBasename}|${params.lemma} (${params.pos})]]`,
		kind: CLOSED_SET_MEMBERSHIP_SECTION_KIND,
		title: CLOSED_SET_MEMBERSHIP_SECTION_TITLE,
	};
}

function buildTagsSection(targetLanguage: TargetLanguage): EntrySection {
	return {
		content: CLOSED_SET_TAG,
		kind: cssSuffixFor[DictSectionKind.Tags],
		title: TitleReprFor[DictSectionKind.Tags][targetLanguage],
	};
}

function hasLibraryPointer(entry: DictEntry, libraryBasename: string): boolean {
	return getMembershipPointerBasenames(entry).includes(libraryBasename);
}

function isClosedSetMembershipEntry(entry: DictEntry): boolean {
	return entry.sections.some(
		(section) => section.kind === CLOSED_SET_MEMBERSHIP_SECTION_KIND,
	);
}

function ensureTagsSection(
	entry: DictEntry,
	targetLanguage: TargetLanguage,
): void {
	const tagsKind = cssSuffixFor[DictSectionKind.Tags];
	const existing = entry.sections.find(
		(section) => section.kind === tagsKind,
	);
	if (!existing) {
		entry.sections.push(buildTagsSection(targetLanguage));
		return;
	}
	if (existing.content.includes(CLOSED_SET_TAG)) {
		return;
	}
	existing.content = existing.content.trim().length
		? `${existing.content.trimEnd()}\n${CLOSED_SET_TAG}`
		: CLOSED_SET_TAG;
}

function appendPointerIfMissing(params: {
	entry: DictEntry;
	membershipSection: EntrySection;
}): void {
	const existingMembershipSection = params.entry.sections.find(
		(section) => section.kind === CLOSED_SET_MEMBERSHIP_SECTION_KIND,
	);
	if (!existingMembershipSection) {
		params.entry.sections.push(params.membershipSection);
		return;
	}
	if (
		existingMembershipSection.content.includes(
			params.membershipSection.content,
		)
	) {
		return;
	}
	existingMembershipSection.content = existingMembershipSection.content.trim()
		.length
		? `${existingMembershipSection.content.trimEnd()}\n${params.membershipSection.content}`
		: params.membershipSection.content;
}

function replacePointers(params: {
	entry: DictEntry;
	membershipSection: EntrySection;
}): void {
	const existingMembershipSection = params.entry.sections.find(
		(section) => section.kind === CLOSED_SET_MEMBERSHIP_SECTION_KIND,
	);
	if (!existingMembershipSection) {
		params.entry.sections.push(params.membershipSection);
		return;
	}
	existingMembershipSection.content = params.membershipSection.content;
}

function basenameFromWikilinkTarget(target: string): string {
	const withoutAnchor = target.split("#")[0] ?? target;
	const segments = withoutAnchor
		.split("/")
		.filter((segment) => segment.length > 0);
	return segments.length > 0
		? (segments[segments.length - 1] ?? withoutAnchor)
		: withoutAnchor;
}

function getMembershipPointerBasenames(entry: DictEntry): string[] {
	const membershipSection = entry.sections.find(
		(section) => section.kind === CLOSED_SET_MEMBERSHIP_SECTION_KIND,
	);
	if (!membershipSection) {
		return [];
	}
	return wikilinkHelper
		.parse(membershipSection.content)
		.map((wikilink) => basenameFromWikilinkTarget(wikilink.target));
}

function buildMembershipEntryId(params: {
	existingEntries: DictEntry[];
	lemmaResult: ClosedSetLexemLemmaResult;
}): string {
	const existingIds = params.existingEntries.map((entry) => entry.id);
	const prefix = dictEntryIdHelper.buildPrefix(
		"Lexem",
		params.lemmaResult.surfaceKind,
		params.lemmaResult.posLikeKind,
	);
	const nextIndex = dictEntryIdHelper.nextIndex(existingIds, prefix);
	return dictEntryIdHelper.build({
		index: nextIndex,
		pos: params.lemmaResult.posLikeKind,
		surfaceKind: params.lemmaResult.surfaceKind,
		unitKind: "Lexem",
	});
}

export function ensureClosedSetMembershipEntry(
	params: EnsureMembershipParams,
): EnsureMembershipResult | null {
	const expectedHeader = `${params.lemmaResult.lemma} (${params.lemmaResult.posLikeKind})`;
	const libraryTarget = resolveClosedSetLibraryTargetForLemma({
		lemmaResult: params.lemmaResult,
		lookupInLibrary: params.lookupInLibrary,
		targetLanguage: params.targetLanguage,
	});
	if (!libraryTarget) {
		return null;
	}

	const membershipSection = buildMembershipSection({
		lemma: params.lemmaResult.lemma,
		libraryBasename: libraryTarget.basename,
		pos: params.lemmaResult.posLikeKind,
	});

	const existingMembership = params.existingEntries.find(
		(entry) =>
			isClosedSetMembershipEntry(entry) &&
			hasLibraryPointer(entry, libraryTarget.basename),
	);
	if (existingMembership) {
		appendPointerIfMissing({
			entry: existingMembership,
			membershipSection,
		});
		ensureTagsSection(existingMembership, params.targetLanguage);
		return {
			entries: params.existingEntries,
			entry: existingMembership,
		};
	}

	const knownLibraryBasenames = new Set(
		params
			.lookupInLibrary(params.lemmaResult.lemma)
			.map((candidate) => candidate.basename),
	);
	knownLibraryBasenames.add(libraryTarget.basename);

	const staleMembership = params.existingEntries.find((entry) => {
		if (!isClosedSetMembershipEntry(entry)) {
			return false;
		}
		if (entry.headerContent !== expectedHeader) {
			return false;
		}
		const pointers = getMembershipPointerBasenames(entry);
		return (
			pointers.length === 0 ||
			pointers.every((pointer) => !knownLibraryBasenames.has(pointer))
		);
	});
	if (staleMembership) {
		replacePointers({
			entry: staleMembership,
			membershipSection,
		});
		ensureTagsSection(staleMembership, params.targetLanguage);
		return {
			entries: params.existingEntries,
			entry: staleMembership,
		};
	}

	const newEntry: DictEntry = {
		headerContent: expectedHeader,
		id: buildMembershipEntryId({
			existingEntries: params.existingEntries,
			lemmaResult: params.lemmaResult,
		}),
		meta: {},
		sections: [membershipSection, buildTagsSection(params.targetLanguage)],
	};

	return {
		entries: [...params.existingEntries, newEntry],
		entry: newEntry,
	};
}
