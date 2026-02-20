import { z } from "zod/v3";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { morphologyRelationHelper } from "../../../../stateless-helpers/morphology-relation";
import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import type { TargetLanguage } from "../../../../types";
import { logger } from "../../../../utils/logger";
import { extractHashTags } from "../../../../utils/text-utils";
import { compareSectionsByWeight } from "../../targets/de/sections/section-config";
import { cssSuffixFor } from "../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../targets/de/sections/section-kind";
import {
	buildSectionMarker,
	ENTRY_SECTION_MARKER_RE,
	ENTRY_SEPARATOR,
	ENTRY_SEPARATOR_RE,
} from "../dict-note/internal/constants";
import {
	dedupeByKey,
	inflectionItemIdentityKey,
	morphologyBacklinkIdentityKey,
	morphologyEquationIdentityKey,
	normalizeCaseFold,
	normalizeSpace,
	normalizeTagToken,
	relationItemIdentityKey,
} from "./normalize";
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
} from "./types";

type TypedSectionKind = keyof SectionPayloadByKind;

export type WikilinkDto = {
	target: string;
	displayText?: string;
};

export type PropagationTypedSection<
	K extends TypedSectionKind = TypedSectionKind,
> = {
	kind: K;
	cssKind: string;
	title: string;
	payload: SectionPayloadByKind[K];
};

type AnyPropagationTypedSection =
	| PropagationTypedSection<"Relation">
	| PropagationTypedSection<"Morphology">
	| PropagationTypedSection<"Inflection">
	| PropagationTypedSection<"Tags">;

export type PropagationRawSection = {
	kind: "Raw";
	cssKind: string;
	title: string;
	rawBlock: string;
};

export type PropagationSection =
	| PropagationRawSection
	| AnyPropagationTypedSection;

export type PropagationNoteEntry = {
	id: string;
	headerContent: string;
	meta: Record<string, unknown>;
	sections: PropagationSection[];
};

export type SerializePropagationNoteResult = {
	body: string;
	meta: Record<string, unknown>;
};

const RELATION_SYMBOL_ORDER = new Map<string, number>([
	["=", 0],
	["≈", 1],
	["≠", 2],
	["⊂", 3],
	["⊃", 4],
	["∈", 5],
	["∋", 6],
]);

const BASIC_WIKILINK_RE = /^\[\[([^\]|#]+)(?:\|([^\]#]+))?\]\]$/;
const ANY_WIKILINK_RE = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/;
const ANY_WIKILINK_GLOBAL_RE = /\[\[[^\]]+\]\]/g;
const WARN_SAMPLE_FIRST_N = 3;
const WARN_SAMPLE_EVERY_N = 50;
const WARN_SAMPLE_MAX_KEYS = 2000;
const warningCountBySampleKey = new Map<string, number>();

const EntriesMetaSchema = z
	.object({ entries: z.record(z.record(z.unknown())).optional() })
	.passthrough();

const typedSectionKindByCssKind = new Map<string, TypedSectionKind>([
	[cssSuffixFor[DictSectionKind.Relation], "Relation"],
	[cssSuffixFor[DictSectionKind.Morphology], "Morphology"],
	[cssSuffixFor[DictSectionKind.Inflection], "Inflection"],
	[cssSuffixFor[DictSectionKind.Tags], "Tags"],
]);

type ParsedSectionMarker = {
	index: number;
	marker: string;
	markerEnd: number;
	cssKind: string;
	title: string;
};

function logSampledWarning(params: {
	message: string;
	sampleKey: string;
	context: Record<string, unknown>;
}): void {
	const key = `${params.message}::${params.sampleKey}`;
	if (
		!warningCountBySampleKey.has(key) &&
		warningCountBySampleKey.size >= WARN_SAMPLE_MAX_KEYS
	) {
		// TODO(telemetry): calibrate sampling cache size with real vault corpus sizes.
		warningCountBySampleKey.clear();
	}
	const nextCount = (warningCountBySampleKey.get(key) ?? 0) + 1;
	warningCountBySampleKey.set(key, nextCount);

	const shouldLog =
		nextCount <= WARN_SAMPLE_FIRST_N ||
		nextCount % WARN_SAMPLE_EVERY_N === 0;
	if (!shouldLog) {
		return;
	}

	logger.warn(params.message, {
		...params.context,
		sampled: nextCount > WARN_SAMPLE_FIRST_N,
		seenCount: nextCount,
	});
}

function collectSectionMarkers(text: string): ParsedSectionMarker[] {
	const markers: ParsedSectionMarker[] = [];
	const regex = new RegExp(ENTRY_SECTION_MARKER_RE.source, "g");
	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const marker = match[0];
		const cssKind = match[1];
		const title = match[2];
		if (
			typeof index !== "number" ||
			typeof marker !== "string" ||
			typeof cssKind !== "string" ||
			typeof title !== "string"
		) {
			continue;
		}
		markers.push({
			cssKind,
			index,
			marker,
			markerEnd: index + marker.length,
			title,
		});
	}
	return markers;
}

function parseBasicWikilinkFromMatch(match: {
	target: string;
	displayText?: string;
}): WikilinkDto | null {
	const target = normalizeSpace(match.target);
	if (target.length === 0) {
		return null;
	}
	const displayText = match.displayText
		? normalizeSpace(match.displayText)
		: undefined;
	return displayText ? { displayText, target } : { target };
}

function parseAnyWikilinkToken(raw: string): {
	target: string;
	displayText?: string;
} | null {
	const trimmed = raw.trim();
	const match = trimmed.match(ANY_WIKILINK_RE);
	if (!match) {
		return null;
	}
	const target = match[1];
	const displayText = match[2];
	if (typeof target !== "string") {
		return null;
	}
	const normalizedTarget = normalizeSpace(target);
	if (normalizedTarget.length === 0) {
		return null;
	}
	if (typeof displayText === "string") {
		const normalizedDisplay = normalizeSpace(displayText);
		return normalizedDisplay.length > 0
			? {
					displayText: normalizedDisplay,
					target: normalizedTarget,
				}
			: {
					target: normalizedTarget,
				};
	}
	return { target: normalizedTarget };
}

export function parseBasicWikilinkDto(raw: string): WikilinkDto | null {
	const trimmed = raw.trim();
	const match = trimmed.match(BASIC_WIKILINK_RE);
	if (!match) {
		return null;
	}
	const target = match[1];
	const displayText = match[2];
	if (typeof target !== "string") {
		return null;
	}
	return parseBasicWikilinkFromMatch({
		displayText: typeof displayText === "string" ? displayText : undefined,
		target,
	});
}

export function serializeWikilinkDto(link: WikilinkDto): string {
	const target = normalizeSpace(link.target);
	if (target.length === 0) {
		logSampledWarning({
			context: { link },
			message:
				"[propagation-note-adapter] Serializing wikilink with empty target",
			sampleKey: "empty-target",
		});
		return "[[]]";
	}
	const displayText = link.displayText
		? normalizeSpace(link.displayText)
		: "";
	if (displayText.length === 0) {
		return `[[${target}]]`;
	}
	return `[[${target}|${displayText}]]`;
}

function extractWikilinkTokensFromText(text: string): string[] {
	const tokens: string[] = [];
	const regex = new RegExp(
		ANY_WIKILINK_GLOBAL_RE.source,
		ANY_WIKILINK_GLOBAL_RE.flags,
	);
	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const fullMatch = match[0];
		if (typeof index !== "number" || typeof fullMatch !== "string") {
			continue;
		}
		const previousChar = index > 0 ? text[index - 1] : "";
		if (previousChar === "!") {
			logSampledWarning({
				context: {
					wikilink: typeof fullMatch === "string" ? fullMatch : "",
				},
				message:
					"[propagation-note-adapter] Skipping embedded wikilink during target extraction",
				sampleKey: fullMatch.trim(),
			});
			continue;
		}
		tokens.push(fullMatch.trim());
	}
	return tokens;
}

function extractBasicWikilinksFromText(text: string): WikilinkDto[] {
	const links: WikilinkDto[] = [];
	for (const token of extractWikilinkTokensFromText(text)) {
		const parsed = parseBasicWikilinkDto(token);
		if (parsed) {
			links.push(parsed);
		}
	}
	return links;
}

function extractPreservedWikilinksFromText(text: string): string[] {
	const preserved: string[] = [];
	for (const token of extractWikilinkTokensFromText(text)) {
		const parsed = parseBasicWikilinkDto(token);
		if (parsed) {
			preserved.push(serializeWikilinkDto(parsed));
			continue;
		}
		const loose = parseAnyWikilinkToken(token);
		if (loose) {
			preserved.push(token.trim());
		}
	}
	return preserved;
}

function serializePreservedWikilink(raw: string): string {
	const basic = parseBasicWikilinkDto(raw);
	if (basic) {
		return serializeWikilinkDto(basic);
	}
	const loose = parseAnyWikilinkToken(raw);
	if (loose) {
		return raw.trim();
	}
	const fallback = normalizeSpace(raw);
	if (fallback.length > 0) {
		return fallback;
	}
	logSampledWarning({
		context: {
			raw,
		},
		message:
			"[propagation-note-adapter] Failed to serialize preserved wikilink; emitting empty marker",
		sampleKey: raw.trim(),
	});
	return "[[]]";
}

function targetLemmaForRelationToken(rawToken: string): string {
	const parsedBasic = parseBasicWikilinkDto(rawToken);
	if (parsedBasic) {
		return parsedBasic.target;
	}
	const loose = parseAnyWikilinkToken(rawToken);
	if (loose) {
		return loose.target;
	}
	return normalizeSpace(rawToken);
}

function parseRelationToken(
	relationKind: string,
	rawToken: string,
	line: string,
): RelationItemDto | null {
	const trimmed = rawToken.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const basic = parseBasicWikilinkDto(trimmed);
	if (basic) {
		return {
			relationKind,
			targetLemma: basic.target,
			targetWikilink: serializeWikilinkDto(basic),
		};
	}
	const preservedTokens = extractPreservedWikilinksFromText(trimmed);
	const preserved = preservedTokens[0] ?? trimmed;
	logSampledWarning({
		context: {
			line,
			token: trimmed,
		},
		message:
			"[propagation-note-adapter] Preserving unsupported relation wikilink token",
		sampleKey: `${relationKind}:${trimmed}`,
	});
	return {
		relationKind,
		targetLemma: targetLemmaForRelationToken(preserved),
		targetWikilink: preserved,
	};
}

function parseEquationPartToken(rawToken: string): string {
	const basic = parseBasicWikilinkDto(rawToken);
	if (basic) {
		return normalizeSpace(basic.target);
	}
	return serializePreservedWikilink(rawToken);
}

function serializeEquationPart(part: string): string {
	const trimmed = part.trim();
	const loose = parseAnyWikilinkToken(trimmed);
	if (loose) {
		return serializePreservedWikilink(trimmed);
	}
	return serializeWikilinkDto({ target: normalizeSpace(trimmed) });
}

function parseMorphologyBacklinkValues(params: {
	line: string;
	relationType: MorphologyBacklinkDto["relationType"];
}): string[] {
	const basicLinks = extractBasicWikilinksFromText(params.line).map((link) =>
		serializeWikilinkDto(link),
	);
	if (basicLinks.length > 0) {
		if (params.relationType === "compounded_from") {
			return basicLinks;
		}
		const first = basicLinks[0];
		return first ? [first] : [];
	}
	const preserved = extractPreservedWikilinksFromText(params.line);
	if (preserved.length === 0) {
		return [];
	}
	if (params.relationType === "compounded_from") {
		return preserved;
	}
	const first = preserved[0];
	return first ? [first] : [];
}

function extractRawEquationTokens(line: string): {
	lhsTokens: string[];
	rhsToken: string;
} | null {
	const equalIndex = line.indexOf("=");
	if (equalIndex < 0) {
		return null;
	}
	const left = line.slice(0, equalIndex);
	const right = line.slice(equalIndex + 1);
	const lhsTokens = extractPreservedWikilinksFromText(left);
	const rhsTokens = extractPreservedWikilinksFromText(right);
	const rhsToken = rhsTokens[0];
	if (lhsTokens.length === 0 || !rhsToken) {
		return null;
	}
	return {
		lhsTokens,
		rhsToken,
	};
}

function parseRelationSection(rawContent: string): RelationSectionDto {
	const items: RelationItemDto[] = [];
	const lines = rawContent.split(/\r?\n/);
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		const relationLineMatch = trimmed.match(/^([=≈≠∈∋⊂⊃])\s+(.+)$/u);
		if (!relationLineMatch) {
			continue;
		}
		const relationKind = relationLineMatch[1];
		const rawTargets = relationLineMatch[2];
		if (
			typeof relationKind !== "string" ||
			typeof rawTargets !== "string"
		) {
			continue;
		}
		for (const token of rawTargets.split(",")) {
			const parsed = parseRelationToken(relationKind, token, trimmed);
			if (!parsed) {
				continue;
			}
			items.push(parsed);
		}
	}
	return {
		items: dedupeByKey(items, relationItemIdentityKey),
		kind: "Relation",
	};
}

function parseMorphologyRelationMarker(
	line: string,
): MorphologyBacklinkDto["relationType"] | null {
	return morphologyRelationHelper.parseMarker(line);
}

function parseMorphologyEquationLine(
	line: string,
): MorphologyEquationDto | null {
	const tokens = extractRawEquationTokens(line);
	if (!tokens) {
		return null;
	}
	return {
		lhsParts: tokens.lhsTokens.map(parseEquationPartToken),
		rhs: parseEquationPartToken(tokens.rhsToken),
	};
}

function parseMorphologySection(rawContent: string): MorphologySectionDto {
	let activeRelationType: MorphologyBacklinkDto["relationType"] | null = null;
	const backlinks: MorphologyBacklinkDto[] = [];
	const equations: MorphologyEquationDto[] = [];

	for (const line of rawContent.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		const relationMarker = parseMorphologyRelationMarker(trimmed);
		if (relationMarker) {
			activeRelationType = relationMarker;
			continue;
		}

		const equation = parseMorphologyEquationLine(trimmed);
		if (equation) {
			equations.push(equation);
			continue;
		}

		if (activeRelationType) {
			const values = parseMorphologyBacklinkValues({
				line: trimmed,
				relationType: activeRelationType,
			});
			if (values.length === 0) {
				logSampledWarning({
					context: {
						line: trimmed,
						relationType: activeRelationType,
					},
					message:
						"[propagation-note-adapter] Skipping unparseable morphology backlink line",
					sampleKey: `${activeRelationType}:${trimmed}`,
				});
				continue;
			}
			for (const value of values) {
				backlinks.push({
					relationType: activeRelationType,
					value,
				});
			}
		}
	}

	return {
		backlinks: dedupeByKey(backlinks, morphologyBacklinkIdentityKey),
		equations: dedupeByKey(equations, morphologyEquationIdentityKey),
		kind: "Morphology",
	};
}

function parseInflectionSection(rawContent: string): InflectionSectionDto {
	const items: InflectionItemDto[] = [];
	for (const line of rawContent.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0) {
			continue;
		}
		const separatorIndex = trimmed.indexOf(":");
		const form =
			separatorIndex >= 0
				? normalizeSpace(trimmed.slice(0, separatorIndex))
				: normalizeSpace(trimmed);
		const rightSide =
			separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
		const tags = dedupeByKey(
			extractHashTags(rightSide).map((tag) => normalizeTagToken(tag)),
			(tag) => tag,
		);
		items.push({ form, tags });
	}
	return {
		items: dedupeByKey(items, inflectionItemIdentityKey),
		kind: "Inflection",
	};
}

function parseTagsSection(rawContent: string): TagsSectionDto {
	const tags = dedupeByKey(
		extractHashTags(rawContent).map((tag) => normalizeTagToken(tag)),
		(tag) => tag,
	).sort((left, right) => left.localeCompare(right));
	return {
		kind: "Tags",
		tags,
	};
}

function parseSectionsForEntry(sectionText: string): PropagationSection[] {
	const markers = collectSectionMarkers(sectionText);
	return markers.map((marker, index) => {
		const sectionEnd =
			index + 1 < markers.length
				? (markers[index + 1]?.index ?? sectionText.length)
				: sectionText.length;
		const rawBlock = sectionText.slice(marker.index, sectionEnd);
		const rawContent = sectionText.slice(marker.markerEnd, sectionEnd);
		const typedKind = typedSectionKindByCssKind.get(marker.cssKind);
		if (!typedKind) {
			return {
				cssKind: marker.cssKind,
				kind: "Raw",
				rawBlock,
				title: marker.title,
			};
		}
		switch (typedKind) {
			case "Relation":
				return {
					cssKind: marker.cssKind,
					kind: "Relation",
					payload: parseRelationSection(rawContent),
					title: marker.title,
				};
			case "Morphology":
				return {
					cssKind: marker.cssKind,
					kind: "Morphology",
					payload: parseMorphologySection(rawContent),
					title: marker.title,
				};
			case "Inflection":
				return {
					cssKind: marker.cssKind,
					kind: "Inflection",
					payload: parseInflectionSection(rawContent),
					title: marker.title,
				};
			case "Tags":
				return {
					cssKind: marker.cssKind,
					kind: "Tags",
					payload: parseTagsSection(rawContent),
					title: marker.title,
				};
		}

		return {
			cssKind: marker.cssKind,
			kind: "Raw",
			rawBlock,
			title: marker.title,
		};
	});
}

function parseEntryChunk(
	chunk: string,
	metaByEntryId: Record<string, Record<string, unknown>>,
): PropagationNoteEntry | null {
	const lines = chunk.split("\n");
	let headerLine: string | null = null;
	for (const line of lines) {
		if (line.trim().length === 0) {
			continue;
		}
		const id = blockIdHelper.extractFromLine(line);
		if (id) {
			headerLine = line;
			break;
		}
	}
	if (!headerLine) {
		return null;
	}

	const id = blockIdHelper.extractFromLine(headerLine);
	if (!id) {
		return null;
	}
	const headerContent = normalizeSpace(
		blockIdHelper.stripFromEnd(headerLine),
	);
	const headerEndOffset = chunk.indexOf(headerLine) + headerLine.length;
	const sectionText = chunk.slice(headerEndOffset);

	return {
		headerContent,
		id,
		meta: metaByEntryId[id] ?? {},
		sections: parseSectionsForEntry(sectionText),
	};
}

function sortSectionsForSerialization(
	sections: ReadonlyArray<PropagationSection>,
): PropagationSection[] {
	return sections
		.map((section, index) => ({ index, section }))
		.sort((left, right) => {
			const weightCompare = compareSectionsByWeight(
				{ kind: left.section.cssKind },
				{ kind: right.section.cssKind },
			);
			if (weightCompare !== 0) {
				return weightCompare;
			}
			return left.index - right.index;
		})
		.map((item) => item.section);
}

function serializeRelationSection(payload: RelationSectionDto): string {
	const grouped = new Map<string, RelationItemDto[]>();
	for (const item of dedupeByKey(payload.items, relationItemIdentityKey)) {
		const group = grouped.get(item.relationKind) ?? [];
		group.push(item);
		grouped.set(item.relationKind, group);
	}

	const sortedKinds = [...grouped.keys()].sort((left, right) => {
		const leftOrder = RELATION_SYMBOL_ORDER.get(left);
		const rightOrder = RELATION_SYMBOL_ORDER.get(right);
		if (leftOrder !== undefined && rightOrder !== undefined) {
			return leftOrder - rightOrder;
		}
		if (leftOrder !== undefined) {
			return -1;
		}
		if (rightOrder !== undefined) {
			return 1;
		}
		return left.localeCompare(right);
	});

	const lines: string[] = [];
	for (const relationKind of sortedKinds) {
		const group = grouped.get(relationKind);
		if (!group || group.length === 0) {
			continue;
		}
		const sortedItems = [...group].sort((left, right) =>
			normalizeCaseFold(left.targetLemma).localeCompare(
				normalizeCaseFold(right.targetLemma),
			),
		);
		const wikilinks = sortedItems.map((item) => {
			const raw = item.targetWikilink.trim();
			if (raw.length > 0) {
				return serializePreservedWikilink(raw);
			}
			return serializeWikilinkDto({
				target: normalizeSpace(item.targetLemma),
			});
		});
		if (wikilinks.length === 0) {
			continue;
		}
		lines.push(`${relationKind} ${wikilinks.join(", ")}`);
	}
	return lines.join("\n");
}

function normalizeBacklinkWikilink(rawValue: string): string {
	return serializePreservedWikilink(rawValue);
}

function serializeMorphologySection(
	payload: MorphologySectionDto,
	targetLanguage: TargetLanguage,
): string {
	const lines: string[] = [];
	const backlinks = dedupeByKey(
		payload.backlinks,
		morphologyBacklinkIdentityKey,
	);
	const relationTypeOrder: ReadonlyArray<
		MorphologyBacklinkDto["relationType"]
	> = ["derived_from", "compounded_from", "used_in"];
	for (const relationType of relationTypeOrder) {
		const typed = backlinks
			.filter((backlink) => backlink.relationType === relationType)
			.sort((left, right) =>
				normalizeCaseFold(left.value).localeCompare(
					normalizeCaseFold(right.value),
				),
			);
		if (typed.length === 0) {
			continue;
		}

		if (relationType === "derived_from") {
			lines.push(
				morphologyRelationHelper.markerForRelationType(
					relationType,
					targetLanguage,
				),
			);
			for (const backlink of typed) {
				lines.push(normalizeBacklinkWikilink(backlink.value));
			}
			continue;
		}

		if (relationType === "compounded_from") {
			lines.push(
				morphologyRelationHelper.markerForRelationType(
					relationType,
					targetLanguage,
				),
			);
			lines.push(
				typed
					.map((backlink) =>
						normalizeBacklinkWikilink(backlink.value),
					)
					.join(" + "),
			);
			continue;
		}

		lines.push(
			morphologyRelationHelper.markerForRelationType(
				relationType,
				targetLanguage,
			),
		);
		for (const backlink of typed) {
			lines.push(normalizeBacklinkWikilink(backlink.value));
		}
	}

	const equations = dedupeByKey(
		payload.equations,
		morphologyEquationIdentityKey,
	).sort((left, right) =>
		morphologyEquationIdentityKey(left).localeCompare(
			morphologyEquationIdentityKey(right),
		),
	);
	for (const equation of equations) {
		const lhs = equation.lhsParts
			.map((part) => serializeEquationPart(part))
			.join(" + ");
		const rhs = serializeEquationPart(equation.rhs);
		lines.push(`${lhs} = ${rhs}`);
	}

	return lines.join("\n");
}

function inferTargetLanguageFromSectionTitle(
	sectionTitle: string,
): TargetLanguage {
	if (sectionTitle === TitleReprFor[DictSectionKind.Morphology].German) {
		return "German";
	}
	return "English";
}

function serializeInflectionSection(payload: InflectionSectionDto): string {
	const items = dedupeByKey(payload.items, inflectionItemIdentityKey).sort(
		(left, right) =>
			normalizeCaseFold(left.form).localeCompare(
				normalizeCaseFold(right.form),
			),
	);
	return items
		.map((item) => {
			const tags = dedupeByKey(
				item.tags.map((tag) => normalizeTagToken(tag)),
				(tag) => tag,
			).sort((left, right) => left.localeCompare(right));
			const normalizedForm = normalizeSpace(item.form);
			if (tags.length === 0) {
				return normalizedForm;
			}
			return `${normalizedForm}: ${tags.join(" ")}`;
		})
		.join("\n");
}

function serializeTagsSection(payload: TagsSectionDto): string {
	const tags = dedupeByKey(
		payload.tags.map((tag) => normalizeTagToken(tag)),
		(tag) => tag,
	).sort((left, right) => left.localeCompare(right));
	return tags.join(" ");
}

function serializeTypedSection(section: AnyPropagationTypedSection): string {
	const marker = buildSectionMarker(section.cssKind, section.title);
	switch (section.kind) {
		case "Relation": {
			const content = serializeRelationSection(section.payload);
			return content.length > 0 ? `${marker}\n${content}` : marker;
		}
		case "Morphology": {
			const content = serializeMorphologySection(
				section.payload,
				inferTargetLanguageFromSectionTitle(section.title),
			);
			return content.length > 0 ? `${marker}\n${content}` : marker;
		}
		case "Inflection": {
			const content = serializeInflectionSection(section.payload);
			return content.length > 0 ? `${marker}\n${content}` : marker;
		}
		case "Tags": {
			const content = serializeTagsSection(section.payload);
			return content.length > 0 ? `${marker}\n${content}` : marker;
		}
	}
}

function serializeSection(section: PropagationSection): string {
	if (section.kind === "Raw") {
		return section.rawBlock;
	}
	return serializeTypedSection(section);
}

function joinSerializedSections(blocks: ReadonlyArray<string>): string {
	let out = "";
	for (const block of blocks) {
		if (out.length === 0) {
			out = block;
			continue;
		}
		const outEndsWithNewline = out.endsWith("\n");
		const blockStartsWithNewline = block.startsWith("\n");
		if (!outEndsWithNewline && !blockStartsWithNewline) {
			out += "\n";
		}
		out += block;
	}
	return out;
}

function serializeEntry(entry: PropagationNoteEntry): string {
	const headerLine = `${entry.headerContent} ^${entry.id}`;
	const sections = sortSectionsForSerialization(entry.sections);
	if (sections.length === 0) {
		return `\n${headerLine}\n`;
	}
	const serializedSections = joinSerializedSections(
		sections.map(serializeSection),
	);
	return `\n${headerLine}\n\n${serializedSections}`;
}

export function parsePropagationNote(noteText: string): PropagationNoteEntry[] {
	const { body } = noteMetadataHelper.decompose(noteText);
	// zod v3/v4 boundary: read() expects v4 ZodSchema, our schema is v3 — runtime-compatible
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const meta = noteMetadataHelper.read(
		noteText,
		EntriesMetaSchema as any,
	) as z.infer<typeof EntriesMetaSchema> | null;
	const metaByEntryId = meta?.entries ?? {};

	const entries: PropagationNoteEntry[] = [];
	for (const chunk of body.split(ENTRY_SEPARATOR_RE)) {
		if (chunk.trim().length === 0) {
			continue;
		}
		const entry = parseEntryChunk(chunk, metaByEntryId);
		if (entry) {
			entries.push(entry);
		}
	}
	return entries;
}

export function serializePropagationNote(
	entries: ReadonlyArray<PropagationNoteEntry>,
): SerializePropagationNoteResult {
	const body = entries
		.map((entry) => serializeEntry(entry))
		.join(ENTRY_SEPARATOR);
	const entriesMeta: Record<string, Record<string, unknown>> = {};
	for (const entry of entries) {
		if (Object.keys(entry.meta).length > 0) {
			entriesMeta[entry.id] = entry.meta;
		}
	}
	return {
		body,
		meta:
			Object.keys(entriesMeta).length > 0 ? { entries: entriesMeta } : {},
	};
}
