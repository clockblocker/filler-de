import type z from "zod/v3";
import type { AbstractLemma } from "../abstract-lemma";
import type { AbstractSelectionFor } from "../abstract-selection";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "../enums/core/selection";
import type { LemmaDiscriminatorFor } from "../lemma-discriminator";

export type LemmaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractLemma<LK, D>;

export type LemmaSchemaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<LemmaFor<LK, D>>;

export type InherentFeaturesFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = LemmaFor<LK, D>["inherentFeatures"];

export type InherentFeaturesSchemaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<InherentFeaturesFor<LK, D>>;

export type SelectionFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = AbstractSelectionFor<OS, SK, LK, D>;

export type SelectionSchemaFor<
	OS extends OrthographicStatus = OrthographicStatus,
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<SelectionFor<OS, SK, LK, D>>;

export type InflectionalFeaturesFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SelectionFor<"Standard", "Inflection", LK, D>["surface"]["inflectionalFeatures"];

export type InflectionalFeaturesSchemaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = z.ZodType<InflectionalFeaturesFor<LK, D>>;
