import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { wikilinkHelper } from "@textfresser/note-addressing/wikilink";
import type { TargetLanguage } from "../../../../../types";
import { resolveClosedSetLibraryTarget } from "../../../common/closed-set-library-target-resolver";
import { isClosedSetPos } from "../../../common/lemma-link-routing";
import type { NoteEntry, NoteSection } from "../../../core/notes/types";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import type { EntrySection } from "../../../domain/dict-note/types";
import { buildSectionMarker } from "../../../domain/dict-note/internal/constants";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../lemma/types";
import {
	adaptLegacySectionsForEntry,
	findFirstTypedSectionByMarker,
	getTypedSectionContent,
	insertSectionByOrder,
	setTypedSectionContent,
} from "./canonical-note-entry";

const CLOSED_SET_MEMBERSHIP_SECTION_KIND = "closed_set_membership";
const CLOSED_SET_MEMBERSHIP_SECTION_TITLE = "Closed-set membership";
const CLOSED_SET_TAG = "#kind/closed-set";

type ClosedSetLexemLemmaResult = Extract<
	LemmaResult,
	{ linguisticUnit: "Lexem" }
>;

type EnsureMembershipParams = {
	existingEntries: NoteEntry[];
	lemmaResult: ClosedSetLexemLemmaResult;
	lookupInLibrary: (coreName: string) => SplitPathToMdFile[];
	targetLanguage: TargetLanguage;
};

type EnsureMembershipResult = {
	entries: NoteEntry[];
	entry: NoteEntry;
};

function normalizeLegacySectionBody(text: string): string {
	return text
		.trim()
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
}

function findMembershipSection(entry: NoteEntry): NoteSection | undefined {
	return entry.sections.find((section) => {
		if (section.kind === "typed") {
			return section.marker === CLOSED_SET_MEMBERSHIP_SECTION_KIND;
		}
		return (
			section.marker === CLOSED_SET_MEMBERSHIP_SECTION_KIND &&
			section.title === CLOSED_SET_MEMBERSHIP_SECTION_TITLE
		);
	});
}

function getMembershipSectionContent(section: NoteSection): string | null {
	if (section.kind === "typed") {
		return section.content;
	}
	if (
		section.marker !== CLOSED_SET_MEMBERSHIP_SECTION_KIND ||
		section.title !== CLOSED_SET_MEMBERSHIP_SECTION_TITLE
	) {
		return null;
	}
	const marker = buildSectionMarker(section.marker, section.title);
	if (!section.rawBlock.startsWith(marker)) {
		return null;
	}
	return normalizeLegacySectionBody(section.rawBlock.slice(marker.length));
}

function setMembershipSectionContent(
	section: NoteSection,
	content: string,
): void {
	if (section.kind === "typed") {
		setTypedSectionContent(section, content);
		return;
	}
	section.rawBlock = `${buildSectionMarker(CLOSED_SET_MEMBERSHIP_SECTION_KIND, CLOSED_SET_MEMBERSHIP_SECTION_TITLE)}\n${content}`;
}

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

function hasLibraryPointer(entry: NoteEntry, libraryBasename: string): boolean {
	return getMembershipPointerBasenames(entry).includes(libraryBasename);
}

function isClosedSetMembershipEntry(entry: NoteEntry): boolean {
	return findMembershipSection(entry) !== undefined;
}

function ensureTagsSection(
	entry: NoteEntry,
	targetLanguage: TargetLanguage,
): void {
	const tagsKind = cssSuffixFor[DictSectionKind.Tags];
	const existing = findFirstTypedSectionByMarker(entry, tagsKind);
	if (!existing) {
		const [section] = adaptLegacySectionsForEntry(entry, [
			buildTagsSection(targetLanguage),
		]);
		if (section) {
			insertSectionByOrder(entry, section);
		}
		return;
	}
	const existingContent = getTypedSectionContent(existing);
	if (existingContent.includes(CLOSED_SET_TAG)) {
		return;
	}
	setTypedSectionContent(
		existing,
		existingContent.trim().length
			? `${existingContent.trimEnd()}\n${CLOSED_SET_TAG}`
			: CLOSED_SET_TAG,
	);
}

function appendPointerIfMissing(params: {
	entry: NoteEntry;
	membershipSection: EntrySection;
}): void {
	const existingMembershipSection = findMembershipSection(params.entry);
	if (!existingMembershipSection) {
		const [section] = adaptLegacySectionsForEntry(params.entry, [
			params.membershipSection,
		]);
		if (section) {
			insertSectionByOrder(params.entry, section);
		}
		return;
	}
	const existingContent = getMembershipSectionContent(existingMembershipSection);
	if (existingContent === null) {
		return;
	}
	if (
		existingContent.includes(params.membershipSection.content)
	) {
		return;
	}
	setMembershipSectionContent(
		existingMembershipSection,
		existingContent.trim().length
			? `${existingContent.trimEnd()}\n${params.membershipSection.content}`
			: params.membershipSection.content,
	);
}

function replacePointers(params: {
	entry: NoteEntry;
	membershipSection: EntrySection;
}): void {
	const existingMembershipSection = findMembershipSection(params.entry);
	if (!existingMembershipSection) {
		const [section] = adaptLegacySectionsForEntry(params.entry, [
			params.membershipSection,
		]);
		if (section) {
			insertSectionByOrder(params.entry, section);
		}
		return;
	}
	setMembershipSectionContent(existingMembershipSection, params.membershipSection.content);
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

function getMembershipPointerBasenames(entry: NoteEntry): string[] {
	const membershipSection = findMembershipSection(entry);
	if (!membershipSection) {
		return [];
	}
	const content = getMembershipSectionContent(membershipSection);
	if (content === null) {
		return [];
	}
	return wikilinkHelper
		.parse(content)
		.map((wikilink) => basenameFromWikilinkTarget(wikilink.target));
}

function buildMembershipEntryId(params: {
	existingEntries: NoteEntry[];
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

	const newEntry: NoteEntry = {
		headerContent: expectedHeader,
		id: buildMembershipEntryId({
			existingEntries: params.existingEntries,
			lemmaResult: params.lemmaResult,
		}),
		meta: {},
		sections: [],
	};
	newEntry.sections.push(
		...adaptLegacySectionsForEntry(newEntry, [
			membershipSection,
			buildTagsSection(params.targetLanguage),
		]),
	);

	return {
		entries: [...params.existingEntries, newEntry],
		entry: newEntry,
	};
}
