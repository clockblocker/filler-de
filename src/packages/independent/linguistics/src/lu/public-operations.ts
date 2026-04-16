import { getOperationPack } from "./internal/operations/operation-pack-registry";
import {
	assertLanguageMatch,
	getLemmaDiscriminators,
	hasResolvedSurfaceTarget,
	type LemmaOfSurface,
	type LemmaLike,
	type KnownSelectionLikeFor,
	type ResolvedLemmaSurfaceFor,
	type ResolvedSurfaceLikeFor,
	type StandardFullSelectionForLemma,
	type StandardFullSelectionForSurface,
	type SurfaceLike,
	type SurfaceOfSelection,
	type UnknownSelectionLikeFor,
	type UnresolvedSurfaceLikeFor,
} from "./internal/operations/shared";
import type { TargetLanguage } from "./universal/enums/core/language";

type StandardFullSelectionOptions = {
	spelledSelection?: string;
};

type ExtractSurfaceFromSelectionFn<L extends TargetLanguage = TargetLanguage> =
	{
		(selection: UnknownSelectionLikeFor<L>): null;
		<S extends KnownSelectionLikeFor<L>>(selection: S): SurfaceOfSelection<S>;
	};

type ExtractLemmaFromSurfaceFn<L extends TargetLanguage = TargetLanguage> = {
	<S extends ResolvedSurfaceLikeFor<L>>(surface: S): LemmaOfSurface<S>;
	<S extends UnresolvedSurfaceLikeFor<L>>(surface: S): null;
	<S extends SurfaceLike<L>>(surface: S): LemmaOfSurface<S> | null;
};

type ToResolvedLemmaSurfaceFn<L extends TargetLanguage = TargetLanguage> = <
	T extends LemmaLike<L>,
>(
	lemma: T,
) => ResolvedLemmaSurfaceFor<T>;

type ToStandardFullSelectionFromSurfaceFn<
	L extends TargetLanguage = TargetLanguage,
> = <S extends SurfaceLike<L>>(
	surface: S,
	options?: StandardFullSelectionOptions,
) => StandardFullSelectionForSurface<S>;

type ToStandardFullSelectionFromLemmaFn<
	L extends TargetLanguage = TargetLanguage,
> = <T extends LemmaLike<L>>(
	lemma: T,
	options?: StandardFullSelectionOptions,
) => StandardFullSelectionForLemma<T>;

type LingOperationApi<L extends TargetLanguage = TargetLanguage> = {
	convert: {
		surface: {
			toStandardFullSelection: ToStandardFullSelectionFromSurfaceFn<L>;
		};
		lemma: {
			toResolvedLemmaSurface: ToResolvedLemmaSurfaceFn<L>;
			toStandardFullSelection: ToStandardFullSelectionFromLemmaFn<L>;
		};
	};
	extract: {
		lemma: {
			fromSurface: ExtractLemmaFromSurfaceFn<L>;
		};
		surface: {
			fromSelection: ExtractSurfaceFromSelectionFn<L>;
		};
	};
};

const extractSurfaceFromSelection = ((
	selection: UnknownSelectionLikeFor | KnownSelectionLikeFor,
) =>
	selection.orthographicStatus === "Unknown"
		? null
		: selection.surface) as ExtractSurfaceFromSelectionFn;

const extractLemmaFromSurface = ((surface: SurfaceLike) =>
	hasResolvedSurfaceTarget(surface)
		? surface.target
		: null) as ExtractLemmaFromSurfaceFn;

const toResolvedLemmaSurface = ((lemma: LemmaLike) => {
	const operationPack = getOperationPack(lemma.language);

	return {
		discriminators: getLemmaDiscriminators(lemma),
		language: lemma.language,
		normalizedFullSurface: operationPack.normalizeLemmaSurface(lemma),
		surfaceKind: "Lemma",
		target: lemma,
	};
}) as ToResolvedLemmaSurfaceFn;

const toStandardFullSelection = ((surface: SurfaceLike, options = {}) => {
	const operationPack = getOperationPack(surface.language);

	return {
		language: surface.language,
		orthographicStatus: "Standard",
		selectionCoverage: "Full",
		spelledSelection:
			options.spelledSelection ??
			operationPack.defaultSpelledSelectionFromSurface?.(surface) ??
			surface.normalizedFullSurface,
		surface,
	};
}) as ToStandardFullSelectionFromSurfaceFn;

const toStandardFullSelectionFromLemma = ((lemma: LemmaLike, options = {}) =>
	toStandardFullSelection(
		toResolvedLemmaSurface(lemma),
		options,
	)) as ToStandardFullSelectionFromLemmaFn;

export function forLanguage<L extends TargetLanguage>(
	language: L,
): LingOperationApi<L> {
	return {
		convert: {
			lemma: {
				toResolvedLemmaSurface: ((lemma) => {
					assertLanguageMatch(language, lemma.language);

					return toResolvedLemmaSurface(lemma);
				}) as ToResolvedLemmaSurfaceFn<L>,
				toStandardFullSelection: ((lemma, options = {}) => {
					assertLanguageMatch(language, lemma.language);

					return toStandardFullSelectionFromLemma(lemma, options);
				}) as ToStandardFullSelectionFromLemmaFn<L>,
			},
			surface: {
				toStandardFullSelection: ((surface, options = {}) => {
					assertLanguageMatch(language, surface.language);

					return toStandardFullSelection(surface, options);
				}) as ToStandardFullSelectionFromSurfaceFn<L>,
			},
		},
		extract: {
			lemma: {
				fromSurface: ((surface) => {
					assertLanguageMatch(language, surface.language);

					return extractLemmaFromSurface(surface);
				}) as ExtractLemmaFromSurfaceFn<L>,
			},
			surface: {
				fromSelection: ((selection) => {
					assertLanguageMatch(language, selection.language);

					return extractSurfaceFromSelection(selection);
				}) as ExtractSurfaceFromSelectionFn<L>,
			},
		},
	};
}

export const LingOperation = {
	convert: {
		lemma: {
			toResolvedLemmaSurface,
			toStandardFullSelection: toStandardFullSelectionFromLemma,
		},
		surface: {
			toStandardFullSelection,
		},
	},
	extract: {
		lemma: {
			fromSurface: extractLemmaFromSurface,
		},
		surface: {
			fromSelection: extractSurfaceFromSelection,
		},
	},
	forLanguage,
} as const;
