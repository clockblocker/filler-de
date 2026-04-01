import { morphologyRelationHelper } from "../../../../stateless-helpers/morphology-relation";
import {
	type ParsedWikilink,
	wikilinkHelper,
} from "@textfresser/note-addressing/wikilink";
import type { TargetLanguage } from "../../../../types";
import { logger } from "../../../../utils/logger";
import { extractHashTags } from "../../../../utils/text-utils";
import type { LanguagePack } from "../../core/contracts/language-pack";
import type { SectionKey } from "../../core/contracts/section-key";
import { createNoteCodec } from "../../core/notes/note-codec";
import type {
	NoteEntry,
	NoteSection,
	TypedNoteSection,
} from "../../core/notes/types";
import { deLanguagePack } from "../../languages/de/pack";
import { buildSectionMarker } from "../dict-note/internal/constants";
import {
	type LibraryBasenameParser,
	type LibraryLookupByCoreName,
	type LinguisticWikilinkDto as ParsedLinguisticWikilinkDto,
	parseSingleLinguisticWikilink,
} from "../linguistic-wikilink";
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
	key?: SectionKey;
	cssKind?: string;
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
	key?: SectionKey;
	cssKind?: string;
	title?: string;
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
const WARN_SAMPLE_FIRST_N = 3;
const WARN_SAMPLE_EVERY_N = 50;
const WARN_SAMPLE_MAX_KEYS = 2000;
const warningCountBySampleKey = new Map<string, number>();

const SUPPORTED_PROPAGATION_SECTION_KEYS = new Set<SectionKey>([
	"relation",
	"morphology",
	"inflection",
	"tags",
]);

function createPropagationLanguagePack(): LanguagePack {
	const sections = deLanguagePack.sections.map((section) =>
		SUPPORTED_PROPAGATION_SECTION_KEYS.has(section.key)
			? section
			: {
					...section,
					claimPolicy: {
						fallback: "raw" as const,
						canClaim() {
							return false;
						},
					},
				},
	);
	const sectionByKey = new Map(sections.map((section) => [section.key, section]));
	const sectionByMarker = new Map(
		sections.map((section) => [section.marker, section]),
	);

	return {
		getSection(key) {
			const section = sectionByKey.get(key);
			if (!section) {
				throw new Error(`Unknown section key: ${key}`);
			}
			return section;
		},
		getSectionByMarker(marker) {
			return sectionByMarker.get(marker);
		},
		sections,
		targetLang: deLanguagePack.targetLang,
	};
}

const noteCodec = createNoteCodec(createPropagationLanguagePack());
const typedSectionKindByKey = new Map<SectionKey, TypedSectionKind>([
	["relation", "Relation"],
	["morphology", "Morphology"],
	["inflection", "Inflection"],
	["tags", "Tags"],
]);
const sectionKeyByTypedSectionKind = new Map<TypedSectionKind, SectionKey>([
	["Relation", "relation"],
	["Morphology", "morphology"],
	["Inflection", "inflection"],
	["Tags", "tags"],
]);
const MORPHOLOGY_SECTION_CSS_KIND =
	deLanguagePack.getSection("morphology").marker;
const RELATION_SECTION_CSS_KIND = deLanguagePack.getSection("relation").marker;
const GERMAN_MORPHOLOGY_TITLE = deLanguagePack
	.getSection("morphology")
	.titleFor("German");

export type ParsePropagationNoteOptions = {
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
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
	const exact = parseExactWikilinkToken(raw);
	if (!exact) {
		return null;
	}
	const normalizedTarget = normalizeSpace(exact.target);
	if (normalizedTarget.length === 0) {
		return null;
	}
	if (typeof exact.alias === "string") {
		const normalizedDisplay = normalizeSpace(exact.alias);
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

function parseExactWikilinkToken(raw: string): ParsedWikilink | null {
	const trimmed = raw.trim();
	const parsed = wikilinkHelper.parse(trimmed);
	if (parsed.length !== 1) {
		return null;
	}
	const first = parsed[0];
	if (!first || first.fullMatch !== trimmed) {
		return null;
	}
	return first;
}

function parseLinguisticWikilinkToken(
	raw: string,
	sectionCssKind: string,
	options?: ParsePropagationNoteOptions,
): ParsedLinguisticWikilinkDto | null {
	const exact = parseExactWikilinkToken(raw);
	if (!exact) {
		return null;
	}
	return parseSingleLinguisticWikilink({
		lookupInLibraryByCoreName: options?.lookupInLibraryByCoreName,
		parseLibraryBasename: options?.parseLibraryBasename,
		sectionCssKind,
		wikilink: exact,
	});
}

function stripAnchorFromTarget(target: string): string {
	const hashIndex = target.indexOf("#");
	if (hashIndex < 0) {
		return target;
	}
	return target.slice(0, hashIndex);
}

function targetLemmaFromLinguisticWikilink(
	wikilink: ParsedLinguisticWikilinkDto,
): string {
	const targetRef = wikilink.targetRef;
	if (targetRef.kind === "WorterNote") {
		return normalizeSpace(targetRef.basename);
	}
	if (targetRef.kind === "LibraryLeaf") {
		return normalizeSpace(targetRef.coreName);
	}
	const stripped = normalizeSpace(stripAnchorFromTarget(wikilink.target));
	if (stripped.length > 0) {
		return stripped;
	}
	return normalizeSpace(wikilink.target);
}

function canonicalWikilinkTargetForMorphologyBacklink(
	wikilink: ParsedLinguisticWikilinkDto,
): string | null {
	const targetRef = wikilink.targetRef;
	if (targetRef.kind === "WorterNote") {
		return normalizeSpace(targetRef.basename);
	}
	if (targetRef.kind === "LibraryLeaf") {
		return normalizeSpace(targetRef.basename);
	}
	const stripped = normalizeSpace(stripAnchorFromTarget(wikilink.target));
	return stripped.length > 0 ? stripped : null;
}

type SemanticTokenPurpose =
	| "RelationLemma"
	| "MorphologyEquationPart"
	| "MorphologyBacklinkTarget";

type SemanticWikilinkTokenResolution = {
	trimmedToken: string;
	basic: WikilinkDto | null;
	parsedLinguistic: ParsedLinguisticWikilinkDto | null;
	canonicalTarget: string | null;
};

function resolveSemanticWikilinkToken(params: {
	rawToken: string;
	sectionCssKind: string;
	purpose: SemanticTokenPurpose;
	options?: ParsePropagationNoteOptions;
	parsedLinguisticHint?: ParsedLinguisticWikilinkDto | null;
}): SemanticWikilinkTokenResolution {
	const trimmedToken = params.rawToken.trim();
	if (trimmedToken.length === 0) {
		return {
			basic: null,
			canonicalTarget: null,
			parsedLinguistic: null,
			trimmedToken,
		};
	}

	const parsedLinguistic =
		params.parsedLinguisticHint ??
		parseLinguisticWikilinkToken(
			trimmedToken,
			params.sectionCssKind,
			params.options,
		);
	const basic = parseBasicWikilinkDto(trimmedToken);

	let canonicalTarget: string | null = null;
	if (parsedLinguistic) {
		const semanticTarget =
			params.purpose === "MorphologyBacklinkTarget"
				? canonicalWikilinkTargetForMorphologyBacklink(parsedLinguistic)
				: targetLemmaFromLinguisticWikilink(parsedLinguistic);
		const normalizedSemanticTarget = normalizeSpace(semanticTarget ?? "");
		if (normalizedSemanticTarget.length > 0) {
			canonicalTarget = normalizedSemanticTarget;
		}
	}

	if (!canonicalTarget && basic) {
		const normalizedBasicTarget = normalizeSpace(basic.target);
		if (normalizedBasicTarget.length > 0) {
			canonicalTarget = normalizedBasicTarget;
		}
	}

	if (!canonicalTarget && params.purpose === "RelationLemma") {
		const loose = parseAnyWikilinkToken(trimmedToken);
		if (loose) {
			canonicalTarget = normalizeSpace(loose.target);
		} else {
			const fallback = normalizeSpace(trimmedToken);
			canonicalTarget = fallback.length > 0 ? fallback : null;
		}
	}

	return {
		basic,
		canonicalTarget,
		parsedLinguistic,
		trimmedToken,
	};
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
	for (const parsed of wikilinkHelper.parseWithRanges(text)) {
		const index = parsed.start;
		const fullMatch = parsed.fullMatch;
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

function parseRelationToken(
	relationKind: string,
	rawToken: string,
	line: string,
	options?: ParsePropagationNoteOptions,
): RelationItemDto | null {
	const trimmed = rawToken.trim();
	if (trimmed.length === 0) {
		return null;
	}
	const resolution = resolveSemanticWikilinkToken({
		options,
		purpose: "RelationLemma",
		rawToken: trimmed,
		sectionCssKind: RELATION_SECTION_CSS_KIND,
	});
	if (resolution.basic) {
		return {
			relationKind,
			targetLemma: resolution.canonicalTarget ?? normalizeSpace(trimmed),
			targetWikilink: serializeWikilinkDto(resolution.basic),
		};
	}
	const preservedTokens = extractPreservedWikilinksFromText(trimmed);
	const preserved = preservedTokens[0] ?? trimmed;
	if (resolution.parsedLinguistic) {
		return {
			relationKind,
			targetLemma:
				resolution.canonicalTarget ?? normalizeSpace(preserved),
			targetWikilink: preserved,
		};
	}
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
		targetLemma: normalizeSpace(preserved),
		targetWikilink: preserved,
	};
}

function parseEquationPartToken(
	rawToken: string,
	options?: ParsePropagationNoteOptions,
): string {
	const resolution = resolveSemanticWikilinkToken({
		options,
		purpose: "MorphologyEquationPart",
		rawToken,
		sectionCssKind: MORPHOLOGY_SECTION_CSS_KIND,
	});
	if (resolution.basic) {
		return normalizeSpace(
			resolution.canonicalTarget ?? resolution.basic.target,
		);
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
	options?: ParsePropagationNoteOptions;
}): string[] {
	const basicLinks = extractWikilinkTokensFromText(params.line)
		.map((token) => {
			const resolution = resolveSemanticWikilinkToken({
				options: params.options,
				purpose: "MorphologyBacklinkTarget",
				rawToken: token,
				sectionCssKind: MORPHOLOGY_SECTION_CSS_KIND,
			});
			if (!resolution.basic) {
				return null;
			}
			const target = normalizeSpace(
				resolution.canonicalTarget ?? resolution.basic.target,
			);
			return serializeWikilinkDto({
				displayText: resolution.basic.displayText,
				target,
			});
		})
		.filter((link): link is string => typeof link === "string");
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

function parseRelationSection(
	rawContent: string,
	options?: ParsePropagationNoteOptions,
): RelationSectionDto {
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
			const parsed = parseRelationToken(
				relationKind,
				token,
				trimmed,
				options,
			);
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
	options?: ParsePropagationNoteOptions,
): MorphologyEquationDto | null {
	const tokens = extractRawEquationTokens(line);
	if (!tokens) {
		return null;
	}
	return {
		lhsParts: tokens.lhsTokens.map((token) =>
			parseEquationPartToken(token, options),
		),
		rhs: parseEquationPartToken(tokens.rhsToken, options),
	};
}

function parseMorphologySection(
	rawContent: string,
	options?: ParsePropagationNoteOptions,
): MorphologySectionDto {
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

		const equation = parseMorphologyEquationLine(trimmed, options);
		if (equation) {
			equations.push(equation);
			continue;
		}

		if (activeRelationType) {
			const values = parseMorphologyBacklinkValues({
				line: trimmed,
				options,
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
	if (sectionTitle === GERMAN_MORPHOLOGY_TITLE) {
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

function resolvePropagationSectionKey(
	section: AnyPropagationTypedSection,
): SectionKey {
	if (section.key) {
		return section.key;
	}
	const key = sectionKeyByTypedSectionKind.get(section.kind);
	if (!key) {
		throw new Error(`Unsupported propagation section kind: ${section.kind}`);
	}
	return key;
}

function adaptTypedNoteSection(
	section: TypedNoteSection,
	options?: ParsePropagationNoteOptions,
): AnyPropagationTypedSection | null {
	const typedKind = typedSectionKindByKey.get(section.key);
	if (!typedKind) {
		return null;
	}

	switch (typedKind) {
		case "Relation":
			return {
				cssKind: section.marker,
				key: section.key,
				kind: "Relation",
				payload: parseRelationSection(section.content, options),
				title: section.title,
			};
		case "Morphology":
			return {
				cssKind: section.marker,
				key: section.key,
				kind: "Morphology",
				payload: parseMorphologySection(section.content, options),
				title: section.title,
			};
		case "Inflection":
			return {
				cssKind: section.marker,
				key: section.key,
				kind: "Inflection",
				payload: parseInflectionSection(section.content),
				title: section.title,
			};
		case "Tags":
			return {
				cssKind: section.marker,
				key: section.key,
				kind: "Tags",
				payload: parseTagsSection(section.content),
				title: section.title,
			};
	}
}

function adaptNoteSection(
	section: NoteSection,
	options?: ParsePropagationNoteOptions,
): PropagationSection {
	if (section.kind === "raw") {
		return {
			cssKind: section.marker,
			key: section.key,
			kind: "Raw",
			rawBlock: section.rawBlock,
			title: section.title,
		};
	}

	const typed = adaptTypedNoteSection(section, options);
	if (typed) {
		return typed;
	}

	return {
		cssKind: section.marker,
		key: section.key,
		kind: "Raw",
		rawBlock: noteCodec.serialize([
			{
				headerContent: "placeholder",
				id: "placeholder",
				meta: {},
				sections: [section],
			},
		]).body.replace(/^\nplaceholder \^placeholder\n\n?/, ""),
		title: section.title,
	};
}

function adaptNoteEntry(
	entry: NoteEntry,
	options?: ParsePropagationNoteOptions,
): PropagationNoteEntry {
	const sections = entry.sections
		.map((section) => adaptNoteSection(section, options))
		.filter((section) => {
			if (section.kind !== "Raw") {
				return true;
			}
			return (
				typeof section.cssKind === "string" ||
				typeof section.title === "string" ||
				section.rawBlock.trim().length > 0
			);
		});

	return {
		headerContent: entry.headerContent,
		id: entry.id,
		meta: entry.meta,
		sections,
	};
}

function serializeTypedSectionContent(
	section: AnyPropagationTypedSection,
): string {
	switch (section.kind) {
		case "Relation":
			return serializeRelationSection(section.payload);
		case "Morphology":
			return serializeMorphologySection(
				section.payload,
				inferTargetLanguageFromSectionTitle(section.title),
			);
		case "Inflection":
			return serializeInflectionSection(section.payload);
		case "Tags":
			return serializeTagsSection(section.payload);
	}
}

function adaptPropagationSection(section: PropagationSection): NoteSection {
	if (section.kind === "Raw") {
		return {
			kind: "raw",
			key: section.key,
			marker: section.cssKind,
			rawBlock: section.rawBlock,
			title: section.title,
		};
	}

	const key = resolvePropagationSectionKey(section);
	const packSection = deLanguagePack.getSection(key);
	return {
		content: serializeTypedSectionContent(section),
		key,
		kind: "typed",
		marker: packSection.marker,
		title: section.title,
	};
}

function adaptPropagationEntry(entry: PropagationNoteEntry): NoteEntry {
	return {
		headerContent: entry.headerContent,
		id: entry.id,
		meta: entry.meta,
		sections: entry.sections.map(adaptPropagationSection),
	};
}

function serializeTypedSection(section: AnyPropagationTypedSection): string {
	const key = resolvePropagationSectionKey(section);
	const marker = buildSectionMarker(
		section.cssKind ?? deLanguagePack.getSection(key).marker,
		section.title,
	);
	const content = serializeTypedSectionContent(section);
	return content.length > 0 ? `${marker}\n${content}` : marker;
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
	if (entry.sections.length === 0) {
		return `\n${headerLine}\n`;
	}
	const serializedSections = joinSerializedSections(
		entry.sections.map(serializeSection),
	);
	return `\n${headerLine}\n\n${serializedSections}`;
}

export function parsePropagationNote(
	noteText: string,
	options?: ParsePropagationNoteOptions,
): PropagationNoteEntry[] {
	return noteCodec
		.parse(noteText)
		.map((entry) => adaptNoteEntry(entry, options));
}

export function serializePropagationNote(
	entries: ReadonlyArray<PropagationNoteEntry>,
): SerializePropagationNoteResult {
	const body = entries.map((entry) => serializeEntry(entry)).join("\n\n\n---\n---\n\n\n");
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
