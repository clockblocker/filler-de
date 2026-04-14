import type {
	AnySelection,
	MorphemeKind,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	SurfaceKind,
	TargetLanguage,
} from "@textfresser/linguistics";

export type KnownSelection = Exclude<
	AnySelection,
	{ orthographicStatus: "Unknown" }
>;

export type SourceTracked = {
	sourceMarkdown?: string;
};

export type IdentityBlock =
	| ({
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Lexeme";
			pos: Pos;
			spelledLemma: string;
	  } & SourceTracked)
	| ({
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			spelledLemma: string;
	  } & SourceTracked)
	| ({
			block: "identity";
			entryKind: "lemma";
			language: TargetLanguage;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			spelledLemma: string;
	  } & SourceTracked)
	| ({
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Lexeme";
			pos: Pos;
			spelledLemma: string;
			spelledSurface: string;
	  } & SourceTracked)
	| ({
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			spelledLemma: string;
			spelledSurface: string;
	  } & SourceTracked)
	| ({
			block: "identity";
			entryKind: "selection";
			language: TargetLanguage;
			orthographicStatus: OrthographicStatus;
			surfaceKind: SurfaceKind;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			spelledLemma: string;
			spelledSurface: string;
	  } & SourceTracked);

export type RootMetaBlock = {
	block: "root_meta";
	discourseFormulaRole?: string;
	emojiDescription?: string[];
	isClosedSet?: boolean;
	separable?: boolean;
	sourceMarkdown?: string;
};

export type RelationPayload = {
	lexicalRelations?: Record<string, unknown>;
	morphologicalRelations?: Record<string, unknown>;
};

export type RelationBlock = {
	block: "relation";
	lexicalRelations?: Record<string, unknown>;
	morphologicalRelations?: Record<string, unknown>;
	sourceMarkdown?: string;
};

export type InherentFeaturesPayload = {
	features: Record<string, unknown>;
};

export type InherentFeaturesBlock = {
	block: "inherent_features";
	features: Record<string, unknown>;
	sourceMarkdown?: string;
};

export type InflectionPayload = {
	canonical?: {
		inflectionalFeatures: Record<string, unknown>;
	};
	rendered?: {
		rows: unknown[];
	};
};

export type InflectionBlock = {
	block: "inflection";
	canonical?: {
		inflectionalFeatures: Record<string, unknown>;
	};
	rendered?: {
		rows: unknown[];
	};
	sourceMarkdown?: string;
};

export type HeaderPayload = {
	markdown: string;
};

export type HeaderBlock = {
	block: "header";
	markdown: string;
	sourceMarkdown?: string;
};

export type TagsPayload = {
	markdown: string;
};

export type TagsBlock = {
	block: "tags";
	markdown: string;
	sourceMarkdown?: string;
};

export type TranslationPayload = {
	markdown: string;
};

export type TranslationBlock = {
	block: "translation";
	markdown: string;
	sourceMarkdown?: string;
};

export type AttestationPayload = {
	markdown: string;
};

export type AttestationBlock = {
	block: "attestation";
	markdown: string;
	sourceMarkdown?: string;
};

export type FreeformBlockPayload = {
	markdown: string;
};

export type FreeformBlock = {
	block: "freeform";
	markdown: string;
	sourceMarkdown?: string;
};

export type StructuredRawBlock = {
	block: "structured_raw";
	blockId: string;
	markdown: string;
	reason: "unknown" | "invalid_payload";
	sourceMarkdown?: string;
};

export type EntryBlock =
	| IdentityBlock
	| RootMetaBlock
	| RelationBlock
	| InherentFeaturesBlock
	| InflectionBlock
	| HeaderBlock
	| TagsBlock
	| TranslationBlock
	| AttestationBlock
	| FreeformBlock
	| StructuredRawBlock;
