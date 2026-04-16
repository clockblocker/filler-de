import { getOperationPack } from "./internal/operations/operation-pack-registry";
import {
	assertLanguageMatch,
	assertSurfaceMatchesLemma,
	type CompatibleLemmaForSurface,
	getLemmaDiscriminators,
	hasResolvedSurfaceTarget,
	type KnownSelectionLikeFor,
	type LemmaLike,
	type LemmaOfSurface,
	type ResolvedSurfaceWithLemma,
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

export const extractSurfaceFromSelection = ((
	selection: UnknownSelectionLikeFor | KnownSelectionLikeFor,
) =>
	selection.orthographicStatus === "Unknown"
		? null
		: selection.surface) as ExtractSurfaceFromSelectionFn;

export const extractLemmaFromSurface = ((surface: SurfaceLike) =>
	hasResolvedSurfaceTarget(surface)
		? surface.target
		: null) as ExtractLemmaFromSurfaceFn;

export const toResolvedLemmaSurface = ((lemma: LemmaLike) => {
	const operationPack = getOperationPack(lemma.language);

	return {
		discriminators: getLemmaDiscriminators(lemma),
		language: lemma.language,
		normalizedFullSurface: operationPack.normalizeLemmaSurface(lemma),
		surfaceKind: "Lemma",
		target: lemma,
	};
}) as ToResolvedLemmaSurfaceFn;

export const toStandardFullSelection = ((
	surface: SurfaceLike,
	options = {},
) => {
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

export const toStandardFullSelectionFromLemma = ((
	lemma: LemmaLike,
	options = {},
) =>
	toStandardFullSelection(
		toResolvedLemmaSurface(lemma),
		options,
	)) as ToStandardFullSelectionFromLemmaFn;

export const resolveUnresolvedSurfaceWithLemma = ((
	surface: UnresolvedSurfaceLikeFor,
	lemma: LemmaLike,
) => {
	assertSurfaceMatchesLemma(
		surface,
		lemma as CompatibleLemmaForSurface<typeof surface>,
	);

	return {
		...surface,
		target: lemma,
	};
}) as ResolveUnresolvedSurfaceWithLemmaFn;

export function operationForLanguage<L extends TargetLanguage>(language: L) {
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

	function boundResolveUnresolvedSurfaceWithLemma<
		S extends UnresolvedSurfaceLikeFor<L>,
		T extends CompatibleLemmaForSurface<S>,
	>(surface: S, lemma: T): ResolvedSurfaceWithLemma<S, T> {
		assertLanguageMatch(language, surface.language);
		assertLanguageMatch(language, lemma.language);

		return resolveUnresolvedSurfaceWithLemma(surface, lemma);
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
		resolve: {
			unresolvedSurface: {
				withLemma: boundResolveUnresolvedSurfaceWithLemma,
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
	} satisfies lingOperationApi<L>;

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

type ResolveUnresolvedSurfaceWithLemmaFn<
	L extends TargetLanguage = TargetLanguage,
> = <
	S extends UnresolvedSurfaceLikeFor<L>,
	T extends CompatibleLemmaForSurface<S>,
>(
	surface: S,
	lemma: T,
) => ResolvedSurfaceWithLemma<S, T>;

type lingOperationApi<L extends TargetLanguage = TargetLanguage> = {
	convert: {
		surface: {
			toStandardFullSelection: ToStandardFullSelectionFromSurfaceFn<L>;
		};
		lemma: {
			toResolvedLemmaSurface: ToResolvedLemmaSurfaceFn<L>;
			toStandardFullSelection: ToStandardFullSelectionFromLemmaFn<L>;
		};
	};
	resolve: {
		unresolvedSurface: {
			withLemma: ResolveUnresolvedSurfaceWithLemmaFn<L>;
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
