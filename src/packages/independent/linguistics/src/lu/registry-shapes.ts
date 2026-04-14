import type z from "zod/v3";
import type { AbstractLemma } from "./universal/abstract-lemma";
import type { AbstractSelectionFor } from "./universal/abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
} from "./universal/enums/core/selection";
import type { LemmaDiscriminatorFor } from "./universal/lemma-discriminator";

type SupportedSelectionLemmaKindsBySurface = {
	Inflection: "Lexeme";
	Lemma: LemmaKind;
	Partial: "Lexeme" | "Phraseme";
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
				[D in LemmaDiscriminatorFor<LK>]: z.ZodType<
					AbstractSelectionFor<OS, SK, LK, D>
				>;
			};
		};
	};
} & {
	Unknown: z.ZodType<AbstractSelectionFor<"Unknown">>;
};

export type LemmaSchemaLanguageShape = {
	[LK in LemmaKind]: {
		[D in LemmaDiscriminatorFor<LK>]: z.ZodType<AbstractLemma<LK, D>>;
	};
};
