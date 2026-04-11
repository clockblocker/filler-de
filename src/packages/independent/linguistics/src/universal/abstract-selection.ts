import type { Prettify } from "src/types/helpers";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { AbstractFeatures } from "./enums/feature/feature";
import type { MorphemeKind } from "./enums/kind/morpheme-kind";
import type { PhrasemeKind } from "./enums/kind/phraseme-kind";
import type { Pos } from "./enums/kind/pos";

type LemmaFieldsFor<LK extends LemmaKind> = LK extends "Lexeme"
	? { pos: Pos }
	: LK extends "Phraseme"
		? { phrasemeKind: PhrasemeKind }
		: LK extends "Morpheme"
			? { morphemeKind: MorphemeKind }
			: never;

type LemmaFor<LK extends LemmaKind = LemmaKind> = LK extends LemmaKind
	? Prettify<LemmaFieldsFor<LK> & { lemmaKind: LK; spelledLemma: string }>
	: never;

type SurfaceFieldsFor<SK extends SurfaceKind> = SK extends "Inflection"
	? { inflectionalFeatures: Partial<AbstractFeatures> }
	: Record<never, never>;

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
> = SK extends SurfaceKind
	? Prettify<
			{
				surfaceKind: SK;
				spelledSurface: string;
			} & SurfaceFieldsFor<SK> & {
					lemma: LemmaFor<LK>;
				}
		>
	: never;

export type AbstractSelectionFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
> = OS extends OrthographicStatus
	? Prettify<
			{
				orthographicStatus: OS;
			} & (OS extends "Unknown"
				? Record<never, never>
				: { surface: SurfaceFor<SK, LK> })
		>
	: never;

type InfCheck = AbstractSelectionFor<"Standard", "Inflection", "Phraseme">;
type InfCheck1 = AbstractSelectionFor<"Standard", "Lemma", "Lexeme">;
