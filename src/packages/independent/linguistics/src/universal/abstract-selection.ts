import type { Prettify } from "../../../../../types/helpers";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { AbstractFeatures } from "./enums/feature/feature";
import type {
	LemmaDiscriminatorFor,
	LemmaIdentityFieldsFor,
} from "./lemma-discriminator";

type LemmaFor<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = LK extends LemmaKind
	? Prettify<
			LemmaIdentityFieldsFor<LK, D> & {
				emojiDescription?: string[];
				lemmaKind: LK;
				spelledLemma: string;
			}
		>
	: never;

type SurfaceFieldsFor<SK extends SurfaceKind> = SK extends "Inflection"
	? { inflectionalFeatures: Partial<AbstractFeatures> }
	: Record<never, never>;

type SurfaceFor<
	SK extends SurfaceKind = SurfaceKind,
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> = SK extends SurfaceKind
	? Prettify<
			{
				surfaceKind: SK;
				spelledSurface: string;
			} & SurfaceFieldsFor<SK> & {
					lemma: LemmaFor<LK, D>;
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
				orthographicStatus: OS;
			} & (OS extends "Unknown"
				? Record<never, never>
				: { surface: SurfaceFor<SK, LK, D> })
		>
	: never;

// type InfCheck1 = AbstractSelectionFor<"Standard", "Lemma", "Lexeme">;
