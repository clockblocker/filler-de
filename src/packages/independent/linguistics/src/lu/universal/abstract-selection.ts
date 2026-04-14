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

type SurfaceTargetFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> =
	| Pick<AbstractLemma<LK, D>, "canonicalLemma">
	| {
			lemma: AbstractLemma<LK, D>;
	  };

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			{
				surfaceKind: SK;
				normalizedFullSurface: string;
			} & SurfaceFieldsFor<SK> & {
					discriminators: DiscriminatorsFor<LK, D>;
					target: SurfaceTargetFor<LK, D>;
				}
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
