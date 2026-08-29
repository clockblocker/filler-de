export type StableEntryId = string;
export type IntentKey = string;
export type CreationKey = string;

type LangCode = string & { readonly __brand: "LangCode" };
type UnitKindCode = string & { readonly __brand: "UnitKindCode" };
type SurfaceKindCode = string & { readonly __brand: "SurfaceKindCode" };
type PosCode = string & { readonly __brand: "PosCode" };




export type RelationItemDto = {
	relationKind: string;
	targetLemma: string;
	targetWikilink: string;
};

export type MorphologyBacklinkDto = {
	relationType: "derived_from" | "compounded_from" | "used_in";
	value: string;
};

export type MorphologyEquationDto = {
	lhsParts: ReadonlyArray<string>;
	rhs: string;
};

export type InflectionItemDto = {
	form: string;
	tags: ReadonlyArray<string>;
};

export type RelationSectionDto = {
	kind: "Relation";
	items: ReadonlyArray<RelationItemDto>;
};

export type MorphologySectionDto = {
	kind: "Morphology";
	backlinks: ReadonlyArray<MorphologyBacklinkDto>;
	equations: ReadonlyArray<MorphologyEquationDto>;
};

export type InflectionSectionDto = {
	kind: "Inflection";
	items: ReadonlyArray<InflectionItemDto>;
};

export type TagsSectionDto = {
	kind: "Tags";
	tags: ReadonlyArray<string>;
};

export type SectionPayloadByKind = {
	Relation: RelationSectionDto;
	Morphology: MorphologySectionDto;
	Inflection: InflectionSectionDto;
	Tags: TagsSectionDto;
};

type NewEntryTemplate = {
	headerTemplate: string;
	meta?: Record<string, unknown>;
};

export type EntryMatchCriteria =
	| { strategy: "byStableId"; stableId: StableEntryId }
	| {
			strategy: "byDeterministicKey";
			lang: LangCode;
			unit: UnitKindCode;
			surface: SurfaceKindCode;
			pos: PosCode;
			lemma: string;
	  }
	| { strategy: "byHeader"; normalizedHeader: string }
	| {
			strategy: "createNew";
			creationKey: CreationKey;
			template: NewEntryTemplate;
	  };

export type SectionMutation =
	| {
			sectionKind: "Relation";
			op: "addRelation";
			relationKind: string;
			targetLemma: string;
			targetWikilink: string;
	  }
	| {
			sectionKind: "Morphology";
			op: "addBacklink";
			backlinkWikilink: string;
			relationType: "derived_from" | "compounded_from" | "used_in";
	  }
	| {
			sectionKind: "Morphology";
			op: "addEquation";
			lhsParts: ReadonlyArray<string>;
			rhs: string;
	  }
	| {
			sectionKind: "Inflection";
			op: "upsertInflection";
			tags: string[];
			headerTemplate: string;
	  }
	| {
			sectionKind: "Tags";
			op: "addTags";
			tags: string[];
	  };

export type PropagationIntent = {
	targetPath: string;
	entryMatch: EntryMatchCriteria;
	mutation: SectionMutation;

	sourceStableId: StableEntryId;
	sourceSection: string;
	sourceNotePath: string;

	creationKey?: CreationKey;
	intentKey: IntentKey;
};




