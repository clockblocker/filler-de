import type { Prettify } from "../../../../../../types/helpers";
import type { TargetLanguage } from "./enums/core/language";
import type {
	LemmaKind,
	OrthographicStatus,
	SurfaceKind,
} from "./enums/core/selection";
import type { IsSeparable } from "./enums/feature/custom/separable";
import type { DiscourseFormulaRole } from "./enums/feature/custom/discourse-formula-role";
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
				discourseFormulaRole?: DiscourseFormulaRole;
				inherentFeatures?: Partial<AbstractFeatures>;
				language: TargetLanguage;
				lemmaKind: LK;
				separable?: IsSeparable;
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
				language: TargetLanguage;
				orthographicStatus: OS;
			} & (OS extends "Unknown"
				? Record<never, never>
				: { surface: SurfaceFor<SK, LK, D> })
		>
	: never;

// type InfCheck1 = AbstractSelectionFor<"Standard", "Lemma", "Lexeme">;
