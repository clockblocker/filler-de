// export type AbstractLemma<U extends Lu> = U

import type { MergeByKey, Prettify } from "src/types/helpers";
import {
	type LemmaKind,
	OrthographicStatus,
	type SurfaceKind,
} from "./enums/core/selection";
import type { MorphemeKind } from "./enums/kind/morpheme-kind";
import type { PhrasemeKind } from "./enums/kind/phraseme-kind";
import type { Pos } from "./enums/kind/pos";

type AbstractLemmaMap = MergeByKey<
	{
		[LemmaKind.Enum.Lexeme]: { pos: Partial<Pos> };
		[LemmaKind.Enum.Phraseme]: { phrasemeKind: Partial<PhrasemeKind> };
		[LemmaKind.Enum.Morpheme]: { morphemeKind: Partial<MorphemeKind> };
	},
	{
		[LK in LemmaKind]: { lemmaKind: LK; spelledLemma: string };
	}
>;

type LemmaFor<LK extends keyof AbstractLemmaMap = keyof AbstractLemmaMap> =
	AbstractLemmaMap[LK];

type AbstractSurfaceMap = {
	[SK in SurfaceKind]: {
		surfaceKind: SK;
		spelledSurface: string;
		lemma: LemmaFor;
	};
};

type AbstractSelectionMap = MergeByKey<
	{
		[OrthographicStatus.Enum.Standard]: {
			surfaceMap: AbstractSurfaceMap;
		};
		[OrthographicStatus.Enum.Typo]: {
			surfaceMap: AbstractSurfaceMap;
		};
		[OrthographicStatus.Enum.Unknown]: {};
	},
	{
		[OS in OrthographicStatus]: { orthographicStatus: OS };
	}
>;

type SurfaceMapFor<OS extends keyof AbstractSelectionMap> =
	AbstractSelectionMap[OS] extends { surfaceMap: infer SM } ? SM : never;

type ReplaceProp<T, K extends PropertyKey, V> = Prettify<
	Omit<T, K> & Record<K, V>
>;

type SurfaceFor<
	OS extends keyof AbstractSelectionMap,
	SK extends keyof SurfaceMapFor<OS>,
	LK extends keyof AbstractLemmaMap = keyof AbstractLemmaMap,
> = SurfaceMapFor<OS>[SK] extends { lemma: any }
	? ReplaceProp<SurfaceMapFor<OS>[SK], "lemma", LemmaFor<LK>>
	: SurfaceMapFor<OS>[SK];

type AbstractSelectionFor<
	OS extends keyof AbstractSelectionMap = keyof AbstractSelectionMap,
	SK extends keyof SurfaceMapFor<OS> = keyof SurfaceMapFor<OS>,
	LK extends keyof AbstractLemmaMap = keyof AbstractLemmaMap,
> = OS extends keyof AbstractSelectionMap
	? Prettify<
			Pick<AbstractSelectionMap[OS], "orthographicStatus"> &
				([SurfaceMapFor<OS>] extends [never]
					? {}
					: { surface: SurfaceFor<OS, SK, LK> })
		>
	: never;

type InfCheck = AbstractSelectionFor<"Standard", "Lemma", "Morpheme">;
