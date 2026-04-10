// export type AbstractLemma<U extends Lu> = U

import type { Prettify } from "src/types/helpers";
import {
	type LemmaKind,
	OrthographicStatus,
	type SurfaceKind,
} from "./enums/core/selection";

type AbstractLemmaMap = {
	[LK in LemmaKind]: { lemmaKind: LemmaKind; spelledLemma: string };
};

type LemmaFor<LK extends keyof AbstractLemmaMap = keyof AbstractLemmaMap> =
	Prettify<AbstractLemmaMap[LK]>;

type AbstractSurfaceMap = {
	[SK in SurfaceKind]: {
		surfaceKind: SK;
		spelledSurface: string;
		lemma: LemmaFor;
	};
};

type SurfaceFor<
	SK extends keyof AbstractSurfaceMap = keyof AbstractSurfaceMap,
> = Prettify<AbstractSurfaceMap[SK]>;

// export type AbstractSelectionMap = Prettify<{
// 	[OrthographicStatus.Enum.Standard]: {
// 		orthographicStatus: typeof OrthographicStatus.Enum.Standard;
// 		surface: SurfaceFor;
// 	};
// 	[OrthographicStatus.Enum.Typo]: {
// 		orthographicStatus: typeof OrthographicStatus.Enum.Typo;
// 		surface: SurfaceFor;
// 	};
// 	[OrthographicStatus.Enum.Unknown]: {
// 		orthographicStatus: typeof OrthographicStatus.Enum.Unknown;
// 	};
// }>;

// type AbstractSelectionFor<OS extends keyof AbstractSelectionMap> = Prettify<
// 	AbstractSelectionMap[OS]
// >;

// --
//
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

type KnownOS = Exclude<
	keyof AbstractSelectionMap,
	typeof OrthographicStatus.Enum.Unknown
>;

type AbstractSelectionFor<
	OS extends keyof AbstractSelectionMap = keyof AbstractSelectionMap,
	SK extends OS extends KnownOS
		? keyof AbstractSelectionMap[OS]["surfaceMap"]
		: never = OS extends KnownOS
		? keyof AbstractSelectionMap[OS]["surfaceMap"]
		: never,
> = OS extends typeof OrthographicStatus.Enum.Unknown
	? {
			orthographicStatus: AbstractSelectionMap[OS]["orthographicStatus"];
		}
	: OS extends KnownOS
		? {
				orthographicStatus: AbstractSelectionMap[OS]["orthographicStatus"];
				surface: AbstractSelectionMap[OS]["surfaceMap"][SK];
			}
		: never;

type asdasd = AbstractSelectionFor<"Standard", "Lemma">;
