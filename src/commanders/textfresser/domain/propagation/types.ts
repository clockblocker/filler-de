export type StableEntryId = string;
export type IntentKey = string;
export type CreationKey = string;

export type LangCode = string & { readonly __brand: "LangCode" };
export type UnitKindCode = string & { readonly __brand: "UnitKindCode" };
export type SurfaceKindCode = string & { readonly __brand: "SurfaceKindCode" };
export type PosCode = string & { readonly __brand: "PosCode" };

export type SourceEntryKey = {
	notePath: string;
	stableId: StableEntryId;
	lemma: string;
	lang: LangCode;
	unit: UnitKindCode;
	surface: SurfaceKindCode;
	pos: PosCode;
};

export type UnresolvedTargetRef<
	TLang extends string,
	TUnit extends string,
	TSurface extends string,
	TPos extends string,
> = {
	targetLemma: string;
	lang: TLang;
	unit: TUnit;
	surface: TSurface;
	pos: TPos;
};

export type TargetRef<
	TLang extends string,
	TUnit extends string,
	TSurface extends string,
	TPos extends string,
> = {
	targetPath: string;
	lang: TLang;
	unit: TUnit;
	surface: TSurface;
	pos: TPos;
};

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

export type NewEntryTemplate = {
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

export type UnresolvedPropagationIntent = Omit<
	PropagationIntent,
	"targetPath"
> & {
	target: UnresolvedTargetRef<
		LangCode,
		UnitKindCode,
		SurfaceKindCode,
		PosCode
	>;
};

export type TargetRefOf<TgtEntry> = TgtEntry extends {
	lang: infer L extends string;
	unit: infer U extends string;
	surface: infer S extends string;
	pos: infer P extends string;
}
	? TargetRef<L, U, S, P>
	: never;

export type UnresolvedTargetRefOf<TgtEntry> = TgtEntry extends {
	lang: infer L extends string;
	unit: infer U extends string;
	surface: infer S extends string;
	pos: infer P extends string;
}
	? UnresolvedTargetRef<L, U, S, P>
	: never;

export interface Propagator<
	SrcEntry,
	TgtEntry,
	K extends keyof SectionPayloadByKind,
> {
	sectionKind: K;
	resolveTargets(input: {
		source: SrcEntry;
		section: SectionPayloadByKind[K];
	}): ReadonlyArray<UnresolvedTargetRefOf<TgtEntry>>;
	buildIntents(input: {
		source: SrcEntry;
		section: SectionPayloadByKind[K];
		target: UnresolvedTargetRefOf<TgtEntry>;
	}): ReadonlyArray<UnresolvedPropagationIntent>;
}
