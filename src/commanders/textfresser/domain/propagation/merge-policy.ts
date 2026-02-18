import type {
	InflectionItemDto,
	InflectionSectionDto,
	MorphologyBacklinkDto,
	MorphologyEquationDto,
	MorphologySectionDto,
	RelationItemDto,
	RelationSectionDto,
	SectionMutation,
	TagsSectionDto,
} from "./types";

export type MergeOutcome<TSection> = {
	section: TSection;
	changed: boolean;
};

type RelationMutation = Extract<SectionMutation, { sectionKind: "Relation" }>;
type MorphologyMutation = Extract<
	SectionMutation,
	{ sectionKind: "Morphology" }
>;
type InflectionMutation = Extract<
	SectionMutation,
	{ sectionKind: "Inflection" }
>;
type TagsMutation = Extract<SectionMutation, { sectionKind: "Tags" }>;

export type ApplySectionMutationInput =
	| {
			section: RelationSectionDto;
			mutation: RelationMutation;
	  }
	| {
			section: MorphologySectionDto;
			mutation: MorphologyMutation;
	  }
	| {
			section: InflectionSectionDto;
			mutation: InflectionMutation;
	  }
	| {
			section: TagsSectionDto;
			mutation: TagsMutation;
	  };

export type ApplySectionMutationResult =
	| MergeOutcome<RelationSectionDto>
	| MergeOutcome<MorphologySectionDto>
	| MergeOutcome<InflectionSectionDto>
	| MergeOutcome<TagsSectionDto>;

function normalizeSpace(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

function normalizeCaseFold(value: string): string {
	return normalizeSpace(value).toLowerCase();
}

function normalizeTagToken(value: string): string {
	return normalizeCaseFold(value).replace(/\s+/g, "-");
}

function dedupeByKey<T>(
	items: ReadonlyArray<T>,
	getKey: (item: T) => string,
): T[] {
	const seen = new Set<string>();
	const deduped: T[] = [];
	for (const item of items) {
		const key = getKey(item);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(item);
	}
	return deduped;
}

function relationItemKey(item: RelationItemDto): string {
	return `${normalizeCaseFold(item.relationKind)}::${normalizeCaseFold(item.targetLemma)}`;
}

function backlinkKey(item: MorphologyBacklinkDto): string {
	return `${item.relationType}::${normalizeCaseFold(item.value)}`;
}

function equationKey(item: MorphologyEquationDto): string {
	const lhs = item.lhsParts.map((part) => normalizeCaseFold(part)).join("+");
	return `${lhs}=>${normalizeCaseFold(item.rhs)}`;
}

function inflectionItemKey(item: InflectionItemDto): string {
	return normalizeCaseFold(item.form);
}

function dedupeTags(tags: ReadonlyArray<string>): string[] {
	const deduped = dedupeByKey(tags, normalizeTagToken);
	return deduped.map((tag) => normalizeTagToken(tag));
}

function applyRelationMutation(
	section: RelationSectionDto,
	mutation: RelationMutation,
): MergeOutcome<RelationSectionDto> {
	const candidate: RelationItemDto = {
		relationKind: mutation.relationKind,
		targetLemma: mutation.targetLemma,
		targetWikilink: mutation.targetWikilink,
	};
	const nextItems = dedupeByKey(
		[...section.items, candidate],
		relationItemKey,
	);
	return {
		changed: nextItems.length !== section.items.length,
		section: {
			...section,
			items: nextItems,
		},
	};
}

function applyMorphologyMutation(
	section: MorphologySectionDto,
	mutation: MorphologyMutation,
): MergeOutcome<MorphologySectionDto> {
	if (mutation.op === "addBacklink") {
		const candidate: MorphologyBacklinkDto = {
			relationType: mutation.relationType,
			value: mutation.backlinkWikilink,
		};
		const nextBacklinks = dedupeByKey(
			[...section.backlinks, candidate],
			backlinkKey,
		);
		return {
			changed: nextBacklinks.length !== section.backlinks.length,
			section: {
				...section,
				backlinks: nextBacklinks,
			},
		};
	}

	const candidate: MorphologyEquationDto = {
		lhsParts: mutation.lhsParts,
		rhs: mutation.rhs,
	};
	const nextEquations = dedupeByKey(
		[...section.equations, candidate],
		equationKey,
	);
	return {
		changed: nextEquations.length !== section.equations.length,
		section: {
			...section,
			equations: nextEquations,
		},
	};
}

function applyInflectionMutation(
	section: InflectionSectionDto,
	mutation: InflectionMutation,
): MergeOutcome<InflectionSectionDto> {
	const targetFormKey = normalizeCaseFold(mutation.headerTemplate);
	let matched = false;
	const nextItems = section.items.map((item) => {
		if (inflectionItemKey(item) !== targetFormKey) {
			return item;
		}
		matched = true;
		return {
			...item,
			tags: dedupeTags([...item.tags, ...mutation.tags]),
		};
	});

	if (matched) {
		return {
			changed:
				JSON.stringify(nextItems) !== JSON.stringify(section.items),
			section: {
				...section,
				items: nextItems,
			},
		};
	}

	return {
		changed: true,
		section: {
			...section,
			items: [
				...section.items,
				{
					form: normalizeSpace(mutation.headerTemplate),
					tags: dedupeTags(mutation.tags),
				},
			],
		},
	};
}

function applyTagsMutation(
	section: TagsSectionDto,
	mutation: TagsMutation,
): MergeOutcome<TagsSectionDto> {
	const nextTags = dedupeTags([...section.tags, ...mutation.tags]);
	return {
		changed:
			nextTags.length !== section.tags.length ||
			nextTags.some((tag, index) => tag !== section.tags[index]),
		section: {
			...section,
			tags: nextTags,
		},
	};
}

export function applySectionMutation(input: {
	section: RelationSectionDto;
	mutation: RelationMutation;
}): MergeOutcome<RelationSectionDto>;
export function applySectionMutation(input: {
	section: MorphologySectionDto;
	mutation: MorphologyMutation;
}): MergeOutcome<MorphologySectionDto>;
export function applySectionMutation(input: {
	section: InflectionSectionDto;
	mutation: InflectionMutation;
}): MergeOutcome<InflectionSectionDto>;
export function applySectionMutation(input: {
	section: TagsSectionDto;
	mutation: TagsMutation;
}): MergeOutcome<TagsSectionDto>;
export function applySectionMutation(
	input: ApplySectionMutationInput,
): ApplySectionMutationResult {
	if (
		input.section.kind === "Relation" &&
		input.mutation.sectionKind === "Relation"
	) {
		return applyRelationMutation(input.section, input.mutation);
	}

	if (
		input.section.kind === "Morphology" &&
		input.mutation.sectionKind === "Morphology"
	) {
		return applyMorphologyMutation(input.section, input.mutation);
	}

	if (
		input.section.kind === "Inflection" &&
		input.mutation.sectionKind === "Inflection"
	) {
		return applyInflectionMutation(input.section, input.mutation);
	}

	if (
		input.section.kind === "Tags" &&
		input.mutation.sectionKind === "Tags"
	) {
		return applyTagsMutation(input.section, input.mutation);
	}

	throw new Error("Unreachable section/mutation combination");
}
