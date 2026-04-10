import type { Prettify } from "src/types/helpers";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { MorphemeKind } from "./enums/kind/morpheme-kind";
import type { PhrasemeKind } from "./enums/kind/phraseme-kind";
import type { Pos } from "./enums/kind/pos";

type LemmaFieldsFor<LK extends LemmaKind> =
	LK extends typeof LemmaKind.Enum.Lexeme
		? { pos: Pos }
		: LK extends typeof LemmaKind.Enum.Phraseme
			? { phrasemeKind: PhrasemeKind }
			: LK extends typeof LemmaKind.Enum.Morpheme
				? { morphemeKind: MorphemeKind }
				: never;

type LemmaFor<LK extends LemmaKind = LemmaKind> = LK extends LemmaKind
	? Prettify<LemmaFieldsFor<LK> & { lemmaKind: LK; spelledLemma: string }>
	: never;

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
> = SK extends SurfaceKind
	? Prettify<{
			surfaceKind: SK;
			spelledSurface: string;
			lemma: LemmaFor<LK>;
		}>
	: never;

type AbstractSelectionFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
> = OS extends OrthographicStatus
	? Prettify<
			{
				orthographicStatus: OS;
			} & (OS extends typeof OrthographicStatus.Enum.Unknown
				? Record<never, never>
				: { surface: SurfaceFor<SK, LK> })
		>
	: never;

type InfCheck = AbstractSelectionFor<"Standard", "Lemma", "Phraseme">;
