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

type DiscriminatorSchemaShape<LK extends LemmaKind> = Partial<{
	[D in LemmaDiscriminatorFor<LK>]: z.ZodTypeAny;
}>;

export type SelectionSchemaLanguageShape = {
	[OS in Exclude<OrthographicStatus, "Unknown">]: {
		[SK in SupportedSelectionSurfaceKind]: {
			[LK in SupportedSelectionLemmaKindFor<SK>]: DiscriminatorSchemaShape<LK>;
		};
	};
} & {
	Unknown: z.ZodTypeAny;
};

export type SurfaceSchemaLanguageShape = {
	[OS in Exclude<OrthographicStatus, "Unknown">]: {
		[SK in SupportedSelectionSurfaceKind]: {
			[LK in SupportedSelectionLemmaKindFor<SK>]: DiscriminatorSchemaShape<LK>;
		};
	};
};

export type LemmaSchemaLanguageShape = {
	[LK in LemmaKind]: DiscriminatorSchemaShape<LK>;
};
