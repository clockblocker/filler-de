import type z from "zod/v3";
import type {
	LemmaKind,
	OrthographicStatus,
} from "./universal/enums/core/selection";
import type { LemmaDiscriminatorFor } from "./universal/lemma-discriminator";

type SupportedSelectionLemmaKindsBySurface = {
	Inflection: "Lexeme";
	Lemma: LemmaKind;
	Variant: "Lexeme";
};

type SupportedSelectionSurfaceKind =
	keyof SupportedSelectionLemmaKindsBySurface;

type SupportedSelectionLemmaKindFor<SK extends SupportedSelectionSurfaceKind> =
	SupportedSelectionLemmaKindsBySurface[SK];

export type SelectionSchemaLanguageShape = {
	[OS in Exclude<OrthographicStatus, "Unknown">]: {
		[SK in SupportedSelectionSurfaceKind]: {
			[LK in SupportedSelectionLemmaKindFor<SK>]: {
				[D in LemmaDiscriminatorFor<LK>]: z.ZodTypeAny;
			};
		};
	};
} & {
	Unknown: z.ZodTypeAny;
};

export type SurfaceSchemaLanguageShape = {
	[OS in Exclude<OrthographicStatus, "Unknown">]: {
		[SK in SupportedSelectionSurfaceKind]: {
			[LK in SupportedSelectionLemmaKindFor<SK>]: {
				[D in LemmaDiscriminatorFor<LK>]: z.ZodTypeAny;
			};
		};
	};
};

export type LemmaSchemaLanguageShape = {
	[LK in LemmaKind]: {
		[D in LemmaDiscriminatorFor<LK>]: z.ZodTypeAny;
	};
};
