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

export type AbstractSelectionMap = Prettify<{
	[OrthographicStatus.Enum.Standard]: {
		orthographicStatus: typeof OrthographicStatus.Enum.Standard;
		surfaceMap: AbstractSurfaceMap;
	};
	[OrthographicStatus.Enum.Typo]: {
		orthographicStatus: typeof OrthographicStatus.Enum.Typo;
		surfaceMap: AbstractSurfaceMap;
	};
	[OrthographicStatus.Enum.Unknown]: {
		orthographicStatus: typeof OrthographicStatus.Enum.Unknown;
	};
}>;

type SurfaceMapFor<OS extends keyof AbstractSelectionMap> =
	OS extends keyof AbstractSelectionMap
		? AbstractSelectionMap[OS] extends { surfaceMap: infer SM }
			? SM
			: never
		: never;

type AbstractSelectionFor<
	OS extends keyof AbstractSelectionMap = keyof AbstractSelectionMap,
	SK extends keyof SurfaceMapFor<OS> = keyof SurfaceMapFor<OS>,
> = OS extends keyof AbstractSelectionMap
	? Prettify<
			Pick<AbstractSelectionMap[OS], "orthographicStatus"> &
				([SurfaceMapFor<OS>] extends [never]
					? {}
					: { surface: SurfaceMapFor<OS>[SK] })
		>
	: never;

type InfCheck = AbstractSelectionFor<"Standard", "Lemma">;
