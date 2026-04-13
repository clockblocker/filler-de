import { identityFeatureRegistry } from "./identity-feature-registry";
import type { AnyLemma, AnySelection, LemmaKind, SurfaceKind } from "./index";
import type { AbstractFeatures } from "./universal/enums/feature/feature";

export type LingId = string & { readonly __brand: "LingId" };

type IdentityFeatureKey = keyof AbstractFeatures;

type IdentityFeatureValue = boolean | number | string;

type IdentityDiscriminator = string;

type NormalizedLinguisticIdentity = {
	discriminator: IdentityDiscriminator;
	emojiDescription: string[];
	identityFeatures: Partial<Record<IdentityFeatureKey, IdentityFeatureValue>>;
	language: string;
	surface: string;
	surfaceKind: SurfaceKind;
	unitKind: LemmaKind;
};

type KnownSelection = Exclude<AnySelection, { orthographicStatus: "Unknown" }>;

type SelectionLemma = KnownSelection["surface"]["lemma"];
type LemmaLike = AnyLemma | SelectionLemma;

export function toLingId(input: AnyLemma | AnySelection): LingId | null {
	if (isSelection(input)) {
		if (input.orthographicStatus === "Unknown") {
			return null;
		}

		if (!input.language) {
			return null;
		}

		const surface = normalizeSurface(input.surface.spelledSurface);
		if (!surface) {
			return null;
		}

		const lemmaSurface = normalizeSurface(input.surface.lemma.spelledLemma);
		if (!lemmaSurface) {
			return null;
		}

		if (
			input.orthographicStatus === "Standard" &&
			input.surface.surfaceKind === "Lemma" &&
			surface !== lemmaSurface
		) {
			return null;
		}

		const normalized = buildNormalizedIdentity({
			emojiDescription: input.surface.lemma.emojiDescription,
			language: input.language,
			lemma: input.surface.lemma,
			surface,
			surfaceKind: input.surface.surfaceKind,
		});
		return normalized ? serializeLingId(normalized) : null;
	}

	if (!input.language) {
		return null;
	}

	const surface = normalizeSurface(input.spelledLemma);
	if (!surface) {
		return null;
	}

	const normalized = buildNormalizedIdentity({
		emojiDescription: input.emojiDescription,
		language: input.language,
		lemma: input,
		surface,
		surfaceKind: "Lemma",
	});
	return normalized ? serializeLingId(normalized) : null;
}

function buildNormalizedIdentity(params: {
	emojiDescription?: string[];
	language: string;
	lemma: LemmaLike;
	surface: string;
	surfaceKind: SurfaceKind;
}): NormalizedLinguisticIdentity | null {
	const unitKind = params.lemma.lemmaKind;
	const discriminator = getDiscriminator(params.lemma);
	if (!discriminator) {
		return null;
	}

	const identityFeatureKeys = getIdentityFeatureKeys(
		params.language,
		unitKind,
		discriminator,
	);
	const identityFeatures = normalizeIdentityFeatures(
		params.lemma,
		identityFeatureKeys,
	);
	if (!identityFeatures) {
		return null;
	}

	return {
		discriminator,
		emojiDescription: normalizeEmojiDescription(params.emojiDescription),
		identityFeatures,
		language: params.language,
		surface: params.surface,
		surfaceKind: params.surfaceKind,
		unitKind,
	};
}

function isSelection(input: AnyLemma | AnySelection): input is AnySelection {
	return "orthographicStatus" in input;
}

function getDiscriminator(lemma: LemmaLike): IdentityDiscriminator | null {
	switch (lemma.lemmaKind) {
		case "Lexeme":
			return "pos" in lemma ? lemma.pos : null;
		case "Morpheme":
			return "morphemeKind" in lemma ? lemma.morphemeKind : null;
		case "Phraseme":
			return "phrasemeKind" in lemma ? lemma.phrasemeKind : null;
	}

	return null;
}

function getIdentityFeatureKeys(
	language: string,
	unitKind: LemmaKind,
	discriminator: IdentityDiscriminator,
): readonly IdentityFeatureKey[] {
	const languageRegistry =
		identityFeatureRegistry[
			language as keyof typeof identityFeatureRegistry
		];
	if (!languageRegistry) {
		return [];
	}

	const unitRegistry = languageRegistry[unitKind];
	if (!unitRegistry) {
		return [];
	}

	return (unitRegistry[discriminator as keyof typeof unitRegistry] ??
		[]) as readonly IdentityFeatureKey[];
}

function normalizeSurface(surface: unknown): string | null {
	if (typeof surface !== "string") {
		return null;
	}

	const normalized = surface.normalize("NFC").trim().replace(/\s+/gu, " ");
	return normalized.length > 0 ? normalized : null;
}

function normalizeEmojiDescription(emojiDescription: unknown): string[] {
	if (!Array.isArray(emojiDescription)) {
		return [];
	}

	return [
		...new Set(
			emojiDescription.map((emoji) => String(emoji).normalize("NFC")),
		),
	].sort();
}

function normalizeIdentityFeatures(
	lemma: LemmaLike,
	keys: readonly IdentityFeatureKey[],
): Partial<Record<IdentityFeatureKey, IdentityFeatureValue>> | null {
	if (keys.length === 0) {
		return {};
	}

	const normalizedEntries = keys
		.slice()
		.sort()
		.map((key) => {
			const value = getIdentityFeatureValue(lemma, key);
			if (value === undefined) {
				return null;
			}

			if (!isScalarIdentityFeatureValue(value)) {
				return null;
			}

			return [
				key,
				typeof value === "string" ? value.normalize("NFC") : value,
			] as const;
		});

	if (normalizedEntries.some((entry) => entry === null)) {
		return null;
	}

	return Object.fromEntries(
		normalizedEntries.filter(
			(
				entry,
			): entry is readonly [IdentityFeatureKey, IdentityFeatureValue] =>
				entry !== null,
		),
	);
}

function getIdentityFeatureValue(
	lemma: LemmaLike,
	key: IdentityFeatureKey,
): unknown {
	if ("inherentFeatures" in lemma && isRecord(lemma.inherentFeatures)) {
		const inherentFeatures =
			lemma.inherentFeatures as Partial<Record<IdentityFeatureKey, unknown>>;
		const inherentValue = inherentFeatures[key];
		if (inherentValue !== undefined) {
			return inherentValue;
		}
	}

	if (key in lemma) {
		return (lemma as Record<string, unknown>)[key];
	}

	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalarIdentityFeatureValue(
	value: unknown,
): value is IdentityFeatureValue {
	return (
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	);
}

function serializeLingId(identity: NormalizedLinguisticIdentity): LingId {
	return `ling:v1:${JSON.stringify(identity)}` as LingId;
}
