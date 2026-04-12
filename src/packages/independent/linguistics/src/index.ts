import z from "zod";
import type { AbstractSelectionFor } from "./universal/abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./universal/enums/core/selection";

const supportedTargetLanguages = ["German"] as const;

const TargetLang = z.enum(supportedTargetLanguages);
type TargetLang = z.infer<typeof TargetLang>;

export const SelectionSchema = {
	German: {
		Standard: {
			Inflection: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Lemma: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Partial: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Variant: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
		},
		Typo: {
			Inflection: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Lemma: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Partial: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Variant: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
		},
		Unknown: {
			Inflection: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Lemma: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Partial: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
			Variant: {
				Lexeme: z.any(),
				Morpheme: z.any(),
				Phraseme: z.any(),
			},
		},
	},
} satisfies {
	[L in TargetLang]: {
		[OS in OrthographicStatus]: {
			[SK in SurfaceKind]: {
				[LK in LemmaKind]: z.ZodType<AbstractSelectionFor<OS, SK, LK>>;
			};
		};
	};
};
