// export type AbstractLemma<U extends Lu> = U

import type {
	EmptyShape,
	MergeByKey,
	Prettify,
	ReplaceProp,
} from "src/types/helpers";
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
		[LemmaKind.Enum.Lexeme]: { pos: Pos };
		[LemmaKind.Enum.Phraseme]: { phrasemeKind: PhrasemeKind };
		[LemmaKind.Enum.Morpheme]: { morphemeKind: MorphemeKind };
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
		[OrthographicStatus.Enum.Unknown]: EmptyShape;
	},
	{
		[OS in OrthographicStatus]: { orthographicStatus: OS };
	}
>;

type SurfaceMapFor<OS extends keyof AbstractSelectionMap> =
	AbstractSelectionMap[OS] extends { surfaceMap: infer SM } ? SM : never;

type SurfaceFor<
	OS extends keyof AbstractSelectionMap,
	SK extends keyof SurfaceMapFor<OS>,
	LK extends keyof AbstractLemmaMap = keyof AbstractLemmaMap,
> = SurfaceMapFor<OS>[SK] extends { lemma: unknown }
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
					? EmptyShape
					: { surface: SurfaceFor<OS, SK, LK> })
		>
	: never;

/** Expeced to be 
 * 
	```type InfCheck = {
		orthographicStatus: "Standard";
		surface: {
		    surfaceKind: "Lemma";
		    spelledSurface: string;
		    lemma: {
		        phrasemeKind: "DiscourseFormula" | "Cliché" | "Aphorism";
		        lemmaKind: "Phraseme";
		        spelledLemma: string;
		    };
	};```
	
	on hover 
}
 */
type InfCheck = AbstractSelectionFor<"Standard", "Lemma", "Phraseme">;
