import type z from "zod/v3";
import type { AbstractLemma } from "./universal/abstract-lemma";
import type { AbstractSelectionFor } from "./universal/abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./universal/enums/core/selection";
import type { LemmaDiscriminatorFor } from "./universal/lemma-discriminator";

export type SelectionSchemaLanguageShape = {
	[OS in OrthographicStatus]: {
		[SK in SurfaceKind]: {
			[LK in LemmaKind]: {
				[D in LemmaDiscriminatorFor<LK>]: z.ZodType<
					AbstractSelectionFor<OS, SK, LK, D>
				>;
			};
		};
	};
};

export type LemmaSchemaLanguageShape = {
	[LK in LemmaKind]: {
		[D in LemmaDiscriminatorFor<LK>]: z.ZodType<AbstractLemma<LK, D>>;
	};
};
