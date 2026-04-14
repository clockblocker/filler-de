import type {
	AnyLemma,
	AnySurface,
	LemmaKind,
	MorphemeKind,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	SurfaceKind,
} from "../lu/public";
import type { TargetLanguage } from "../lu/universal/enums/core/language";

export type LemmaLingId = string;
export type SurfaceLingId = string;
export type ShallowSurfaceLingId = string;
export type LingId = LemmaLingId | SurfaceLingId;
export type LingIdSurfaceInput<
	L extends TargetLanguage = TargetLanguage,
> = AnySurface<L> & {
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
};

type ParsedFeatureValue = string | boolean;
type ParsedFeatureBag = Record<string, ParsedFeatureValue>;

export type ParsedLemmaDto =
	| ({
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Lexeme";
			pos: Pos;
			inherentFeatures: ParsedFeatureBag;
			meaningInEmojis?: string;
	  } & Record<never, never>)
	| ({
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Morpheme";
			morphemeKind: MorphemeKind;
			isClosedSet?: boolean;
			separable?: boolean;
			meaningInEmojis?: string;
	  } & Record<never, never>)
	| ({
			lingKind: "Lemma";
			language: TargetLanguage;
			canonicalLemma: string;
			lemmaKind: "Phraseme";
			phrasemeKind: PhrasemeKind;
			meaningInEmojis?: string;
			discourseFormulaRole?: string;
	  } & Record<never, never>);

export type ParsedSurfaceDto = {
	lingKind: "Surface";
	language: TargetLanguage;
	orthographicStatus: Exclude<OrthographicStatus, "Unknown">;
	surfaceKind: Exclude<SurfaceKind, never>;
	normalizedFullSurface: string;
	discriminators: {
		lemmaKind: LemmaKind;
		lemmaSubKind: string;
	};
	target:
		| { canonicalLemma: string }
		| { lemma: ParsedLemmaDto };
	inflectionalFeatures?: ParsedFeatureBag;
};

export type ParsedLingDto = ParsedLemmaDto | ParsedSurfaceDto;
type ParsedLingDtoFor<L extends TargetLanguage> = ParsedLingDto & {
	language: L;
};
type ParsedLemmaDtoFor<L extends TargetLanguage> = ParsedLemmaDto & {
	language: L;
};
type ParsedSurfaceDtoFor<L extends TargetLanguage> = ParsedSurfaceDto & {
	language: L;
};

type SerializableLemma = AnyLemma | ParsedLemmaDto;
type SerializableSurface = LingIdSurfaceInput | ParsedSurfaceDto;

type LingIdKind = "LEM" | "SURF" | "SURF-SHALLOW";

const BOOLEAN_FEATURE_KEYS = new Set([
	"abbr",
	"foreign",
	"isClosedSet",
	"isPhrasal",
	"poss",
	"reflex",
	"separable",
]);

const LANGUAGE_TO_CODE = {
	English: "EN",
	German: "DE",
} as const satisfies Record<TargetLanguage, string>;

const CODE_TO_LANGUAGE = {
	DE: "German",
	EN: "English",
} as const satisfies Record<string, TargetLanguage>;

const ESCAPABLE_TOKEN_CHARS = /[%;,=\-]/g;
const ESCAPED_DASH = "%2D";

const languageSerializers = {
	English: {
		toLemmaLingId: (value: SerializableLemma) => serializeLemma("English", value),
		toSurfaceLingId: (value: SerializableSurface) =>
			serializeSurface("English", value),
		toShallowSurfaceLingId: (value: SerializableSurface) =>
			serializeShallowSurface("English", value),
	},
	German: {
		toLemmaLingId: (value: SerializableLemma) => serializeLemma("German", value),
		toSurfaceLingId: (value: SerializableSurface) =>
			serializeSurface("German", value),
		toShallowSurfaceLingId: (value: SerializableSurface) =>
			serializeShallowSurface("German", value),
	},
} as const satisfies Record<
	TargetLanguage,
	{
		toLemmaLingId: (value: SerializableLemma) => LemmaLingId;
		toSurfaceLingId: (value: SerializableSurface) => SurfaceLingId;
		toShallowSurfaceLingId: (
			value: SerializableSurface,
		) => ShallowSurfaceLingId;
	}
>;

export function buildToLingIdFor<L extends TargetLanguage>(lang: L): (
	value:
		| AnyLemma<L>
		| LingIdSurfaceInput<L>
		| ParsedLingDtoFor<L>
		| ParsedLemmaDto
		| ParsedSurfaceDto,
) => LingId {
	return (value) => {
		const serializer = getSerializerForValue(lang, value);

		return isSurfaceValue(value)
			? serializer.toSurfaceLingId(value)
			: serializer.toLemmaLingId(value);
	};
}

export function buildToLemmaLingIdFor<L extends TargetLanguage>(lang: L): (
	value: AnyLemma<L> | ParsedLemmaDtoFor<L> | ParsedLemmaDto,
) => LemmaLingId {
	return (value) => getSerializerForValue(lang, value).toLemmaLingId(value);
}

export function buildToSurfaceLingIdFor<L extends TargetLanguage>(lang: L): (
	value:
		| LingIdSurfaceInput<L>
		| ParsedSurfaceDtoFor<L>
		| ParsedSurfaceDto,
) => SurfaceLingId {
	return (value) => getSerializerForValue(lang, value).toSurfaceLingId(value);
}

export function buildToShallowSurfaceLingIdFor<
	L extends TargetLanguage,
>(lang: L): (
	value:
		| LingIdSurfaceInput<L>
		| ParsedSurfaceDtoFor<L>
		| ParsedSurfaceDto,
) => ShallowSurfaceLingId {
	return (value) =>
		getSerializerForValue(lang, value).toShallowSurfaceLingId(value);
}

export function parseLingId(id: LingId): ParsedLingDto {
	const { body, kind, language } = parseHeader(id);

	if (kind === "LEM") {
		return parseLemmaBody(language, body);
	}

	if (kind === "SURF") {
		return parseSurfaceBody(language, body);
	}

	throw new Error(`Unsupported Ling ID kind: ${kind}`);
}

function serializeLemma(
	language: TargetLanguage,
	value: SerializableLemma,
): LemmaLingId {
	const subKind = getLemmaSubKind(value);
	const lemmaFeatures = serializeFeatureBag(getLemmaFeatures(value));

	return joinLingId([
		buildHeader(language, "LEM"),
		escapeToken(value.canonicalLemma),
		value.lemmaKind,
		subKind,
		lemmaFeatures,
		serializeOptionalToken(value.meaningInEmojis),
	]);
}

function serializeSurface(
	language: TargetLanguage,
	value: SerializableSurface,
): SurfaceLingId {
	const targetMode = "lemma" in value.target ? "lemma" : "canon";
	const targetPayload =
		targetMode === "lemma"
			? escapeToken(serializeLemma(language, value.target.lemma))
			: escapeToken(value.target.canonicalLemma);

	return joinLingId([
		buildHeader(language, "SURF"),
		...serializeSurfaceShell(value),
		targetMode,
		targetPayload,
	]);
}

function serializeShallowSurface(
	language: TargetLanguage,
	value: SerializableSurface,
): ShallowSurfaceLingId {
	return joinLingId([
		buildHeader(language, "SURF-SHALLOW"),
		...serializeSurfaceShell(value),
	]);
}

function serializeSurfaceShell(value: SerializableSurface): string[] {
	return [
		escapeToken(value.normalizedFullSurface),
		value.orthographicStatus,
		value.surfaceKind,
		value.discriminators.lemmaKind,
		value.discriminators.lemmaSubKind,
		value.surfaceKind === "Inflection"
			? serializeFeatureBag(value.inflectionalFeatures ?? {})
			: "-",
	];
}

function parseLemmaBody(language: TargetLanguage, body: string): ParsedLemmaDto {
	const parts = body.split(";");

	if (parts.length !== 5) {
		throw new Error(`Malformed lemma Ling ID: ${body}`);
	}

	const [canonicalLemmaToken, lemmaKind, lemmaSubKind, featuresToken, meaning] =
		parts;
	const canonicalLemma = unescapeToken(canonicalLemmaToken);
	const meaningInEmojis = parseOptionalToken(meaning);

	switch (lemmaKind) {
		case "Lexeme":
			return {
				canonicalLemma,
				inherentFeatures: parseFeatureBag(featuresToken),
				language,
				lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis,
				pos: lemmaSubKind as Pos,
			};
		case "Morpheme": {
			const lemmaFeatures = parseFeatureBag(featuresToken);

			return {
				canonicalLemma,
				...(lemmaFeatures.isClosedSet === undefined
					? {}
					: { isClosedSet: expectBooleanFeature("isClosedSet", lemmaFeatures) }),
				language,
				lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis,
				morphemeKind: lemmaSubKind as MorphemeKind,
				...(lemmaFeatures.separable === undefined
					? {}
					: { separable: expectBooleanFeature("separable", lemmaFeatures) }),
			};
		}
		case "Phraseme": {
			const lemmaFeatures = parseFeatureBag(featuresToken);
			const discourseFormulaRole = lemmaFeatures.discourseFormulaRole;

			if (
				discourseFormulaRole !== undefined &&
				typeof discourseFormulaRole !== "string"
			) {
				throw new Error("Expected discourseFormulaRole to deserialize as a string");
			}
			const parsedDiscourseFormulaRole =
				typeof discourseFormulaRole === "string"
					? discourseFormulaRole
					: undefined;

			return {
				canonicalLemma,
				...(parsedDiscourseFormulaRole === undefined
					? {}
					: { discourseFormulaRole: parsedDiscourseFormulaRole }),
				language,
				lemmaKind,
				lingKind: "Lemma",
				meaningInEmojis,
				phrasemeKind: lemmaSubKind as PhrasemeKind,
			};
		}
		default:
			throw new Error(`Unsupported lemma kind in Ling ID: ${lemmaKind}`);
	}
}

function parseSurfaceBody(
	language: TargetLanguage,
	body: string,
): ParsedSurfaceDto {
	const parts = body.split(";");

	if (parts.length !== 8) {
		throw new Error(`Malformed surface Ling ID: ${body}`);
	}

	const [
		normalizedFullSurfaceToken,
		orthographicStatus,
		surfaceKind,
		lemmaKind,
		lemmaSubKind,
		inflectionalFeaturesToken,
		targetMode,
		targetPayloadToken,
	] = parts;

	const target =
		targetMode === "canon"
			? { canonicalLemma: unescapeToken(targetPayloadToken) }
			: targetMode === "lemma"
				? { lemma: expectParsedLemma(parseLingId(unescapeToken(targetPayloadToken))) }
				: unsupportedTargetMode(targetMode);
	return {
		discriminators: {
			lemmaKind: lemmaKind as LemmaKind,
			lemmaSubKind,
		},
		...(surfaceKind === "Inflection"
			? {
					inflectionalFeatures: parseFeatureBag(inflectionalFeaturesToken),
				}
			: {}),
		language,
		lingKind: "Surface",
		normalizedFullSurface: unescapeToken(normalizedFullSurfaceToken),
		orthographicStatus: orthographicStatus as Exclude<
			OrthographicStatus,
			"Unknown"
		>,
		surfaceKind: surfaceKind as SurfaceKind,
		target,
	};
}

function getLemmaSubKind(value: SerializableLemma): string {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.pos;
		case "Morpheme":
			return value.morphemeKind;
		case "Phraseme":
			return value.phrasemeKind;
	}
}

function getLemmaFeatures(value: SerializableLemma): ParsedFeatureBag {
	switch (value.lemmaKind) {
		case "Lexeme":
			return value.inherentFeatures;
		case "Morpheme":
			return compactFeatureBag({
				isClosedSet: value.isClosedSet,
				separable: value.separable,
			});
		case "Phraseme":
			return compactFeatureBag({
				discourseFormulaRole:
					"discourseFormulaRole" in value
						? value.discourseFormulaRole
						: undefined,
			});
	}
}

function compactFeatureBag(
	bag: Record<string, ParsedFeatureValue | undefined>,
): ParsedFeatureBag {
	return Object.fromEntries(
		Object.entries(bag).filter(([, value]) => value !== undefined),
	);
}

function serializeFeatureBag(features: ParsedFeatureBag): string {
	const entries = Object.entries(features)
		.filter(([, value]) => value !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));

	if (entries.length === 0) {
		return "-";
	}

	return entries
		.map(
			([key, value]) =>
				`${escapeToken(key)}=${escapeToken(serializeFeatureValue(value))}`,
		)
		.join(",");
}

function serializeFeatureValue(value: ParsedFeatureValue): string {
	return typeof value === "boolean" ? (value ? "Yes" : "No") : value;
}

function parseFeatureBag(token: string): ParsedFeatureBag {
	if (token === "-") {
		return {};
	}

	return Object.fromEntries(
		token.split(",").map((entry) => {
			const separatorIndex = entry.indexOf("=");

			if (separatorIndex === -1) {
				throw new Error(`Malformed feature entry in Ling ID: ${entry}`);
			}

			const key = unescapeToken(entry.slice(0, separatorIndex));
			const value = unescapeToken(entry.slice(separatorIndex + 1));

			return [key, parseFeatureValue(key, value)];
		}),
	);
}

function parseFeatureValue(key: string, value: string): ParsedFeatureValue {
	if (!BOOLEAN_FEATURE_KEYS.has(key)) {
		return value;
	}

	if (value === "Yes" || value === "true") {
		return true;
	}

	if (value === "No" || value === "false") {
		return false;
	}

	throw new Error(`Malformed boolean feature value for ${key}: ${value}`);
}

function expectBooleanFeature(
	key: "isClosedSet" | "separable",
	features: ParsedFeatureBag,
): boolean {
	const value = features[key];

	if (typeof value !== "boolean") {
		throw new Error(`Expected ${key} to deserialize as a boolean`);
	}

	return value;
}

function serializeOptionalToken(value: string | undefined): string {
	return value === undefined ? "-" : escapeToken(value);
}

function parseOptionalToken(token: string): string | undefined {
	return token === "-" ? undefined : unescapeToken(token);
}

function buildHeader(language: TargetLanguage, kind: LingIdKind): string {
	return `ling:v1:${LANGUAGE_TO_CODE[language]}:${kind}`;
}

function parseHeader(id: string): {
	body: string;
	kind: LingIdKind;
	language: TargetLanguage;
} {
	const separatorIndex = id.indexOf(";");

	if (separatorIndex === -1) {
		throw new Error(`Malformed Ling ID: ${id}`);
	}

	const header = id.slice(0, separatorIndex);
	const body = id.slice(separatorIndex + 1);
	const [namespace, version, languageCode, kind] = header.split(":");

	if (namespace !== "ling" || version !== "v1") {
		throw new Error(`Unsupported Ling ID prefix: ${header}`);
	}

	const language = CODE_TO_LANGUAGE[languageCode];

	if (language === undefined) {
		throw new Error(`Unsupported language code in Ling ID: ${languageCode}`);
	}

	if (kind !== "LEM" && kind !== "SURF" && kind !== "SURF-SHALLOW") {
		throw new Error(`Unsupported Ling ID kind: ${kind}`);
	}

	return { body, kind, language };
}

function joinLingId(parts: string[]): string {
	return `${parts[0]};${parts.slice(1).join(";")}`;
}

function escapeToken(value: string): string {
	return value.replace(ESCAPABLE_TOKEN_CHARS, (char) =>
		char === "-" ? ESCAPED_DASH : encodeURIComponent(char),
	);
}

function unescapeToken(value: string): string {
	return decodeURIComponent(value);
}

function isSurfaceValue(
	value: SerializableLemma | SerializableSurface,
): value is SerializableSurface {
	return "surfaceKind" in value;
}

function getSerializerForValue(
	lang: TargetLanguage,
	value: { language?: TargetLanguage },
) {
	if (value.language !== undefined) {
		assertLanguageMatch(lang, value.language);

		return languageSerializers[value.language];
	}

	return languageSerializers[lang];
}

function expectParsedLemma(parsed: ParsedLingDto): ParsedLemmaDto {
	if (parsed.lingKind !== "Lemma") {
		throw new Error("Expected nested lemma Ling ID inside surface target");
	}

	return parsed;
}

function unsupportedTargetMode(targetMode: string): never {
	throw new Error(`Unsupported target mode in Ling ID: ${targetMode}`);
}

function assertLanguageMatch(expected: TargetLanguage, actual: TargetLanguage) {
	if (expected !== actual) {
		throw new Error(
			`Ling ID builder language mismatch: expected ${expected}, received ${actual}`,
		);
	}
}
