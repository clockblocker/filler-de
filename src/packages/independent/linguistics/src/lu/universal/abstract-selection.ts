import type { Prettify } from "../../../../../../types/helpers";
import type { AbstractLemma } from "./abstract-lemma";
import type { TargetLanguage } from "./enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { AbstractFeatures } from "./enums/feature/feature";
import type { LemmaDiscriminatorFor } from "./lemma-discriminator";

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

type LooseSurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = Pick<AbstractLemma<LK, D>, "canonicalLemma">;

type ObservedSurfaceTargetFor<
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

export type AbstractLooseSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			SurfaceBaseFor<SK, LK, D> & {
				target: LooseSurfaceTargetFor<LK, D>;
			}
		>
	: never;

export type AbstractObservedSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			SurfaceBaseFor<SK, LK, D> & {
				target: ObservedSurfaceTargetFor<LK, D>;
			}
		>
	: never;

export type AbstractSurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractLooseSurfaceFor<SK, LK, D> | AbstractObservedSurfaceFor<SK, LK, D>;

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			{
				target:
					| LooseSurfaceTargetFor<LK, D>
					| ObservedSurfaceTargetFor<LK, D>;
			} & SurfaceBaseFor<SK, LK, D>
		>
	: never;

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
