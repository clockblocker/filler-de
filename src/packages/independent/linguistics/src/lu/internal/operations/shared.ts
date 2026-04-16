import type { TargetLanguage } from "../../universal/enums/core/language";

export type LemmaLike<L extends TargetLanguage = TargetLanguage> =
	| {
			canonicalLemma: string;
			language: L;
			lemmaKind: "Lexeme";
			pos: string;
	  }
	| {
			canonicalLemma: string;
			language: L;
			lemmaKind: "Morpheme";
			morphemeKind: string;
	  }
	| {
			canonicalLemma: string;
			language: L;
			lemmaKind: "Phraseme";
			phrasemeKind: string;
	  };

export type SurfaceLike<L extends TargetLanguage = TargetLanguage> = {
	discriminators: {
		lemmaKind: string;
		lemmaSubKind: string;
	};
	language: L;
	normalizedFullSurface: string;
	surfaceKind: string;
	target: { canonicalLemma: string } | LemmaLike<L>;
};

export type UnknownSelectionLikeFor<L extends TargetLanguage = TargetLanguage> =
	{
		language: L;
		orthographicStatus: "Unknown";
		spelledSelection: string;
	};

export type KnownSelectionLikeFor<L extends TargetLanguage = TargetLanguage> = {
	language: L;
	orthographicStatus: "Standard" | "Typo";
	surface: SurfaceLike<L>;
};

export type SurfaceOfSelection<S extends { surface: unknown }> = S extends {
	surface: infer SelectionSurface;
}
	? SelectionSurface
	: never;

export type ResolvedSurfaceLikeFor<L extends TargetLanguage = TargetLanguage> =
	SurfaceLike<L> & { target: LemmaLike<L> };

export type UnresolvedSurfaceLikeFor<
	L extends TargetLanguage = TargetLanguage,
> = SurfaceLike<L> & { target: { canonicalLemma: string } };

export type LemmaOfSurface<S extends { target: unknown }> = S extends {
	target: infer SurfaceTarget;
}
	? Extract<SurfaceTarget, { lemmaKind: unknown }>
	: never;

type LemmaDiscriminatorOf<T extends LemmaLike> = T extends {
	lemmaKind: "Lexeme";
	pos: infer D;
}
	? Extract<D, string>
	: T extends {
				lemmaKind: "Morpheme";
				morphemeKind: infer D;
			}
		? Extract<D, string>
		: T extends {
					lemmaKind: "Phraseme";
					phrasemeKind: infer D;
				}
			? Extract<D, string>
			: never;

export type ResolvedLemmaSurfaceFor<T extends LemmaLike> = {
	discriminators: {
		lemmaKind: T["lemmaKind"];
		lemmaSubKind: LemmaDiscriminatorOf<T>;
	};
	language: T["language"];
	normalizedFullSurface: string;
	surfaceKind: "Lemma";
	target: T;
};

export type StandardFullSelectionForSurface<
	T extends { language: TargetLanguage },
> = {
	language: T["language"];
	orthographicStatus: "Standard";
	selectionCoverage: "Full";
	spelledSelection: string;
	surface: T;
};

export type StandardFullSelectionForLemma<T extends LemmaLike> =
	StandardFullSelectionForSurface<ResolvedLemmaSurfaceFor<T>>;

export function assertLanguageMatch(
	expected: TargetLanguage,
	actual: TargetLanguage,
): void {
	if (expected !== actual) {
		throw new Error(
			`LingOperation language mismatch: expected ${expected}, received ${actual}`,
		);
	}
}

export function hasResolvedSurfaceTarget<L extends TargetLanguage>(
	surface: SurfaceLike<L>,
): surface is ResolvedSurfaceLikeFor<L> {
	return (
		typeof surface.target === "object" &&
		surface.target !== null &&
		"lemmaKind" in surface.target
	);
}

export function getLemmaDiscriminators<T extends LemmaLike>(
	lemma: T,
): ResolvedLemmaSurfaceFor<T>["discriminators"] {
	switch (lemma.lemmaKind) {
		case "Lexeme":
			return {
				lemmaKind: lemma.lemmaKind,
				lemmaSubKind: lemma.pos,
			} as ResolvedLemmaSurfaceFor<T>["discriminators"];
		case "Morpheme":
			return {
				lemmaKind: lemma.lemmaKind,
				lemmaSubKind: lemma.morphemeKind,
			} as ResolvedLemmaSurfaceFor<T>["discriminators"];
		case "Phraseme":
			return {
				lemmaKind: lemma.lemmaKind,
				lemmaSubKind: lemma.phrasemeKind,
			} as ResolvedLemmaSurfaceFor<T>["discriminators"];
	}
}
