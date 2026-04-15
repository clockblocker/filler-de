import type { Prettify } from "../../../../../../types/helpers";
import type { AbstractLemma } from "./abstract-lemma";
import type { TargetLanguage } from "./enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { AbstractFeatures } from "./enums/feature";
import type { LemmaDiscriminatorFor } from "./lemma-discriminator";

export type AbstractUnresolvedSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			SurfaceBaseFor<SK, LK, D> & {
				target: UnresolvedSurfaceTargetFor<LK, D>;
			}
		>
	: never;

export type AbstractResolvedSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			SurfaceBaseFor<SK, LK, D> & {
				target: ResolvedSurfaceTargetFor<LK, D>;
			}
		>
	: never;

export type AbstractSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> =
	| AbstractUnresolvedSurfaceFor<SK, LK, D>
	| AbstractResolvedSurfaceFor<SK, LK, D>;

export type AbstractSelectionFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = OS extends OrthographicStatus
	? Prettify<
			{
				language: TargetLanguage;
				orthographicStatus: OS;
				spelledSelection: string;
			} & (OS extends "Unknown"
				? Record<never, never>
				: { surface: SurfaceFor<SK, LK, D> })
		>
	: never;

type DiscriminatorsFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = Prettify<{
	lemmaKind: LK;
	lemmaSubKind: D;
}>;

type SurfaceFieldsFor<SK extends SurfaceKind> = SK extends "Inflection"
	? { inflectionalFeatures: Partial<AbstractFeatures> }
	: Record<never, never>;

type UnresolvedSurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = Pick<AbstractLemma<LK, D>, "canonicalLemma">;

type ResolvedSurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractLemma<LK, D>;

type SurfaceBaseFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = Prettify<
	{
		surfaceKind: SK;
		normalizedFullSurface: string;
	} & SurfaceFieldsFor<SK> & {
			discriminators: DiscriminatorsFor<LK, D>;
		}
>;

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			{
				target:
					| UnresolvedSurfaceTargetFor<LK, D>
					| ResolvedSurfaceTargetFor<LK, D>;
			} & SurfaceBaseFor<SK, LK, D>
		>
	: never;
