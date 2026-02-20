import { describe, expect, it } from "bun:test";
import { dictNoteHelper } from "../../../../../src/commanders/textfresser/domain/dict-note";
import type {
	PropagationNoteEntry,
	PropagationSection,
} from "../../../../../src/commanders/textfresser/domain/propagation";
import {
	parsePropagationNote,
	serializePropagationNote,
} from "../../../../../src/commanders/textfresser/domain/propagation";
import type {
	InflectionItemDto,
	InflectionSectionDto,
	MorphologyBacklinkDto,
	MorphologyEquationDto,
	MorphologySectionDto,
	RelationItemDto,
	RelationSectionDto,
	SectionPayloadByKind,
	TagsSectionDto,
} from "../../../../../src/commanders/textfresser/domain/propagation/types";

const TYPED_NOTE_FIXTURE = [
	"🏠 das [[Haus]] ^l-nom-n-h1",
	"",
	'<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>',
	"= [[Heim]], [[Gebäude|Gebäude]]",
	"≈ [[Wohnung]]",
	'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
	"Abgeleitet von:",
	" [[ Wurzel ]] ",
	"Besteht aus:",
	"[[Haus]] + [[Boot]]",
	"Verwendet in:",
	"[[Hausboot]] *(boat house)*",
	"[[ab|ab]] + [[fahren]] = [[abfahren]] *(to depart)*",
	'<span class="entry_section_title entry_section_title_flexion">Flexion</span>',
	"Nominativ: #nominative/singular #nominative/plural",
	"Genitiv: #genitive/singular",
	'<span class="entry_section_title entry_section_title_tags">Tags</span>',
	"#Noun/Common #nominative/singular",
	'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
	"house",
].join("\n");

const RAW_TRANSLATION_BLOCK = [
	'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
	"line 1  ",
	"",
	"line 2\t",
	"",
].join("\r\n");

const RAW_ONLY_NOTE_FIXTURE = `wort ^raw-1\r\n\r\n${RAW_TRANSLATION_BLOCK}`;
const EXOTIC_TYPED_NOTE_FIXTURE = [
	"🧪 exotisch ^x-1",
	"",
	'<span class="entry_section_title entry_section_title_synonyme">Semantische Beziehungen</span>',
	"= [[Haus#^13|Haus]], [[Heim]]",
	'<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>',
	"Verwendet in:",
	"[[Haus#^13|Haus]]",
	"[[ab#^1|ab]] + [[fahren]] = [[abfahren]]",
].join("\n");
const MORPHOLOGY_DTO_ROUNDTRIP_ENTRY: PropagationNoteEntry = {
	headerContent: "ab-",
	id: "m-1",
	meta: {},
	sections: [
		{
			cssKind: "morphologie",
			kind: "Morphology",
			payload: {
				backlinks: [
					{
						relationType: "used_in",
						value: "[[Hausboot]]",
					},
				],
				equations: [
					{
						lhsParts: ["ab", "fahren"],
						rhs: "abfahren",
					},
				],
				kind: "Morphology",
			},
			title: "Morphologische Relationen",
		},
	],
};

const RELATION_LINE_RE = /^([=≈≠∈∋⊂⊃])\s+(.+)$/u;
const BASIC_WIKILINK_GLOBAL_RE = /\[\[([^\]|#]+)(?:\|([^\]#]+))?\]\]/g;

type TypedSectionKind = "Relation" | "Morphology" | "Inflection" | "Tags";

function normalizeSpace(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function normalizeCaseFold(value: string): string {
	return normalizeSpace(value).toLowerCase();
}

function normalizeTagToken(value: string): string {
	return normalizeCaseFold(value).replace(/\s+/g, "-");
}

function legacySerializeWikilink(target: string, displayText?: string): string {
	const normalizedTarget = normalizeSpace(target);
	const normalizedDisplay = displayText ? normalizeSpace(displayText) : "";
	if (normalizedDisplay.length === 0) {
		return `[[${normalizedTarget}]]`;
	}
	return `[[${normalizedTarget}|${normalizedDisplay}]]`;
}

function parseLegacyWikilinks(text: string): Array<{
	target: string;
	displayText?: string;
}> {
	const links: Array<{ target: string; displayText?: string }> = [];
	const regex = new RegExp(
		BASIC_WIKILINK_GLOBAL_RE.source,
		BASIC_WIKILINK_GLOBAL_RE.flags,
	);
	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const target = match[1];
		const displayText = match[2];
		if (typeof index !== "number" || typeof target !== "string") {
			continue;
		}
		const previousChar = index > 0 ? text[index - 1] : "";
		if (previousChar === "!") {
			continue;
		}
		links.push(
			typeof displayText === "string"
				? {
						displayText,
						target,
					}
				: {
						target,
					},
		);
	}
	return links;
}

function parseLegacyRelationSection(content: string): RelationSectionDto {
	const items: RelationItemDto[] = [];
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		const relationMatch = trimmed.match(RELATION_LINE_RE);
		if (!relationMatch) {
			continue;
		}
		const relationKind = relationMatch[1];
		const payload = relationMatch[2];
		if (typeof relationKind !== "string" || typeof payload !== "string") {
			continue;
		}
		for (const link of parseLegacyWikilinks(payload)) {
			items.push({
				relationKind,
				targetLemma: normalizeSpace(link.target),
				targetWikilink: legacySerializeWikilink(
					link.target,
					link.displayText,
				),
			});
		}
	}
	return {
		items,
		kind: "Relation",
	};
}

function parseLegacyMorphologySection(content: string): MorphologySectionDto {
	let relationType: "derived_from" | "compounded_from" | "used_in" | null = null;
	const backlinks: MorphologyBacklinkDto[] = [];
	const equations: MorphologyEquationDto[] = [];

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		if (trimmed === "Abgeleitet von:") {
			relationType = "derived_from";
			continue;
		}
		if (trimmed === "Besteht aus:") {
			relationType = "compounded_from";
			continue;
		}
		if (trimmed === "Verwendet in:") {
			relationType = "used_in";
			continue;
		}

		const equalIndex = trimmed.indexOf("=");
		if (equalIndex >= 0) {
			const lhsLinks = parseLegacyWikilinks(trimmed.slice(0, equalIndex));
			const rhsLinks = parseLegacyWikilinks(trimmed.slice(equalIndex + 1));
			const rhs = rhsLinks[0];
			if (lhsLinks.length > 0 && rhs) {
				equations.push({
					lhsParts: lhsLinks.map((link) => normalizeSpace(link.target)),
					rhs: normalizeSpace(rhs.target),
				});
				continue;
			}
		}

		if (relationType) {
			const links = parseLegacyWikilinks(trimmed);
			if (links.length === 0) {
				continue;
			}
			if (relationType === "compounded_from") {
				for (const link of links) {
					backlinks.push({
						relationType,
						value: legacySerializeWikilink(
							link.target,
							link.displayText,
						),
					});
				}
				continue;
			}
			const first = links[0];
			if (!first) {
				continue;
			}
			backlinks.push({
				relationType,
				value: legacySerializeWikilink(first.target, first.displayText),
			});
			continue;
		}

	}

	return {
		backlinks,
		equations,
		kind: "Morphology",
	};
}

function parseLegacyInflectionSection(content: string): InflectionSectionDto {
	const items: InflectionItemDto[] = [];
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		const separatorIndex = trimmed.indexOf(":");
		const form =
			separatorIndex < 0
				? normalizeSpace(trimmed)
				: normalizeSpace(trimmed.slice(0, separatorIndex));
		const rightSide =
			separatorIndex < 0 ? trimmed : trimmed.slice(separatorIndex + 1);
		const tags = (rightSide.match(/#[^\s]+/g) ?? []).map((tag) =>
			normalizeTagToken(tag),
		);
		items.push({ form, tags });
	}
	return {
		items,
		kind: "Inflection",
	};
}

function parseLegacyTagsSection(content: string): TagsSectionDto {
	const tags = (content.match(/#[^\s]+/g) ?? []).map((tag) =>
		normalizeTagToken(tag),
	).sort((left, right) => left.localeCompare(right));
	return {
		kind: "Tags",
		tags,
	};
}

function getSectionContentByCssKind(
	v1Entry: ReturnType<typeof dictNoteHelper.parse>[number],
	cssKind: string,
): string {
	for (const section of v1Entry.sections) {
		if (section.kind === cssKind) {
			return section.content;
		}
	}
	return "";
}

function getTypedPayload(
	entry: PropagationNoteEntry,
	kind: "Relation",
): SectionPayloadByKind["Relation"] | null;
function getTypedPayload(
	entry: PropagationNoteEntry,
	kind: "Morphology",
): SectionPayloadByKind["Morphology"] | null;
function getTypedPayload(
	entry: PropagationNoteEntry,
	kind: "Inflection",
): SectionPayloadByKind["Inflection"] | null;
function getTypedPayload(
	entry: PropagationNoteEntry,
	kind: "Tags",
): SectionPayloadByKind["Tags"] | null;
function getTypedPayload(
	entry: PropagationNoteEntry,
	kind: TypedSectionKind,
): SectionPayloadByKind[TypedSectionKind] | null {
	switch (kind) {
		case "Relation": {
			const section = entry.sections.find(
				(candidate): candidate is Extract<PropagationSection, { kind: "Relation" }> =>
					candidate.kind === "Relation",
			);
			return section?.payload ?? null;
		}
		case "Morphology": {
			const section = entry.sections.find(
				(candidate): candidate is Extract<PropagationSection, { kind: "Morphology" }> =>
					candidate.kind === "Morphology",
			);
			return section?.payload ?? null;
		}
		case "Inflection": {
			const section = entry.sections.find(
				(candidate): candidate is Extract<PropagationSection, { kind: "Inflection" }> =>
					candidate.kind === "Inflection",
			);
			return section?.payload ?? null;
		}
		case "Tags": {
			const section = entry.sections.find(
				(candidate): candidate is Extract<PropagationSection, { kind: "Tags" }> =>
					candidate.kind === "Tags",
			);
			return section?.payload ?? null;
		}
	}
}

describe("propagation note adapter", () => {
	it("parses typed sections with DTO semantics equivalent to legacy parsed section content", () => {
		const legacyEntries = dictNoteHelper.parse(TYPED_NOTE_FIXTURE);
		const legacyEntry = legacyEntries[0];
		if (!legacyEntry) {
			throw new Error("Expected legacy fixture to parse one entry");
		}
		const expectedRelation = parseLegacyRelationSection(
			getSectionContentByCssKind(legacyEntry, "synonyme"),
		);
		const expectedMorphology = parseLegacyMorphologySection(
			getSectionContentByCssKind(legacyEntry, "morphologie"),
		);
		const expectedInflection = parseLegacyInflectionSection(
			getSectionContentByCssKind(legacyEntry, "flexion"),
		);
		const expectedTags = parseLegacyTagsSection(
			getSectionContentByCssKind(legacyEntry, "tags"),
		);

		const currentEntries = parsePropagationNote(TYPED_NOTE_FIXTURE);
		const currentEntry = currentEntries[0];
		if (!currentEntry) {
			throw new Error("Expected current fixture to parse one entry");
		}

		const actualRelation = getTypedPayload(currentEntry, "Relation");
		const actualMorphology = getTypedPayload(currentEntry, "Morphology");
		const actualInflection = getTypedPayload(currentEntry, "Inflection");
		const actualTags = getTypedPayload(currentEntry, "Tags");

		expect(actualRelation).toEqual(expectedRelation);
		expect(actualMorphology).toEqual(expectedMorphology);
		expect(actualMorphology?.equations).toHaveLength(1);
		expect(actualInflection).toEqual(expectedInflection);
		expect(actualTags).toEqual(expectedTags);
	});

	it("serializes deterministically and canonicalizes typed morphology backlink wikilinks", () => {
		const parsed = parsePropagationNote(TYPED_NOTE_FIXTURE);
		const first = serializePropagationNote(parsed);
		const second = serializePropagationNote(parsePropagationNote(first.body));

		expect(second.body).toBe(first.body);
		expect(first.body.includes("Abgeleitet von:\n[[Wurzel]]")).toBe(true);
	});

	it("round-trips morphology DTO with backlinks and equations without reclassifying equations", () => {
		const serialized = serializePropagationNote([MORPHOLOGY_DTO_ROUNDTRIP_ENTRY]);
		const reparsedEntries = parsePropagationNote(serialized.body);
		const reparsed = reparsedEntries[0];
		if (!reparsed) {
			throw new Error("Expected reparsed morphology entry");
		}
		const morphology = getTypedPayload(reparsed, "Morphology");
		expect(morphology).toBeDefined();
		if (!morphology) {
			return;
		}
		expect(morphology.backlinks).toEqual([
			{
				relationType: "used_in",
				value: "[[Hausboot]]",
			},
		]);
		expect(morphology.equations).toHaveLength(1);
		expect(morphology.equations[0]).toEqual({
			lhsParts: ["ab", "fahren"],
			rhs: "abfahren",
		});
	});

	it("preserves exotic wikilinks in typed sections across parse/serialize roundtrip", () => {
		const parsed = parsePropagationNote(EXOTIC_TYPED_NOTE_FIXTURE);
		const serialized = serializePropagationNote(parsed);
		expect(serialized.body.includes("[[Haus#^13|Haus]]")).toBe(true);
		expect(serialized.body.includes("[[ab#^1|ab]] + [[fahren]] = [[abfahren]]")).toBe(
			true,
		);

		const reparsed = parsePropagationNote(serialized.body);
		const entry = reparsed[0];
		if (!entry) {
			throw new Error("Expected reparsed exotic fixture entry");
		}
		const relation = getTypedPayload(entry, "Relation");
		const morphology = getTypedPayload(entry, "Morphology");
		expect(
			relation?.items.some(
				(item) => item.targetWikilink.trim() === "[[Haus#^13|Haus]]",
			),
		).toBe(true);
		expect(morphology?.equations).toHaveLength(1);
		expect(morphology?.equations[0]).toEqual({
			lhsParts: ["[[ab#^1|ab]]", "fahren"],
			rhs: "abfahren",
		});
	});

	it("preserves untouched raw passthrough section bytes exactly", () => {
		const parsed = parsePropagationNote(RAW_ONLY_NOTE_FIXTURE);
		const entry = parsed[0];
		if (!entry) {
			throw new Error("Expected raw fixture to parse one entry");
		}
		const rawSection = entry.sections.find((section) => section.kind === "Raw");
		expect(rawSection).toBeDefined();
		if (!rawSection || rawSection.kind !== "Raw") {
			return;
		}
		expect(rawSection.rawBlock).toBe(RAW_TRANSLATION_BLOCK);

		const serialized = serializePropagationNote(parsed);
		expect(serialized.body.includes(RAW_TRANSLATION_BLOCK)).toBe(true);
	});

	it("strips legacy top-level metadata mirrors on parse", () => {
		const noteWithLegacyMeta = [
			"wort ^raw-1",
			"",
			'<span class="entry_section_title entry_section_title_translations">Übersetzung</span>',
			"word",
			"",
			'<section id="textfresser_meta_keep_me_invisible">',
			JSON.stringify({
				entries: {
					"raw-1": {
						emojiDescription: ["🧪"],
						ipa: "ipa",
						semantics: "legacy semantics",
						senseGloss: "legacy gloss",
						verbEntryIdentity: "conjugation:Irregular",
					},
				},
			}),
			"</section>",
		].join("\n");

		const parsed = parsePropagationNote(noteWithLegacyMeta);
		expect(parsed).toHaveLength(1);
		expect(parsed[0]?.meta).toEqual({
			verbEntryIdentity: "conjugation:Irregular",
		});
	});
});
