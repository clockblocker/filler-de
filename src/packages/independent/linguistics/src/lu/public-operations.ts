import { getOperationPack } from "./internal/operations/operation-pack-registry";
import {
	assertLanguageMatch,
	getLemmaDiscriminators,
	hasResolvedSurfaceTarget,
	type KnownSelectionLikeFor,
	type LemmaLike,
	type LemmaOfSurface,
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

export function forLanguage<L extends TargetLanguage>(language: L) {
	function boundToResolvedLemmaSurface<T extends LemmaLike<L>>(
		lemma: T,
	): ResolvedLemmaSurfaceFor<T> {
		assertLanguageMatch(language, lemma.language);

		return toResolvedLemmaSurface(lemma);
	}

	function boundToStandardFullSelectionFromLemma<T extends LemmaLike<L>>(
		lemma: T,
		options?: StandardFullSelectionOptions,
	): StandardFullSelectionForLemma<T> {
		assertLanguageMatch(language, lemma.language);

		return toStandardFullSelectionFromLemma(lemma, options);
	}

	function boundToStandardFullSelectionFromSurface<S extends SurfaceLike<L>>(
		surface: S,
		options?: StandardFullSelectionOptions,
	): StandardFullSelectionForSurface<S> {
		assertLanguageMatch(language, surface.language);

		return toStandardFullSelection(surface, options);
	}

	function boundExtractLemmaFromSurface<S extends ResolvedSurfaceLikeFor<L>>(
		surface: S,
	): LemmaOfSurface<S>;
	function boundExtractLemmaFromSurface<
		S extends UnresolvedSurfaceLikeFor<L>,
	>(surface: S): null;
	function boundExtractLemmaFromSurface<S extends SurfaceLike<L>>(
		surface: S,
	): LemmaOfSurface<S> | null {
		assertLanguageMatch(language, surface.language);

		return extractLemmaFromSurface(surface);
	}

	function boundExtractSurfaceFromSelection(
		selection: UnknownSelectionLikeFor<L>,
	): null;
	function boundExtractSurfaceFromSelection<
		S extends KnownSelectionLikeFor<L>,
	>(selection: S): SurfaceOfSelection<S>;
	function boundExtractSurfaceFromSelection(
		selection: UnknownSelectionLikeFor<L> | KnownSelectionLikeFor<L>,
	) {
		assertLanguageMatch(language, selection.language);

		return selection.orthographicStatus === "Unknown"
			? null
			: selection.surface;
	}

	const api = {
		convert: {
			lemma: {
				toResolvedLemmaSurface: boundToResolvedLemmaSurface,
				toStandardFullSelection: boundToStandardFullSelectionFromLemma,
			},
			surface: {
				toStandardFullSelection:
					boundToStandardFullSelectionFromSurface,
			},
		},
		extract: {
			lemma: {
				fromSurface: boundExtractLemmaFromSurface,
			},
			surface: {
				fromSelection: boundExtractSurfaceFromSelection,
			},
		},
	} satisfies LingOperationApi<L>;

	return api;
}

type StandardFullSelectionOptions = {
	spelledSelection?: string;
};

type ExtractSurfaceFromSelectionFn<L extends TargetLanguage = TargetLanguage> =
	{
		(selection: UnknownSelectionLikeFor<L>): null;
		<S extends KnownSelectionLikeFor<L>>(
			selection: S,
		): SurfaceOfSelection<S>;
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
