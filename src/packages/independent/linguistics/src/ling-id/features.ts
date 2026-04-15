import { escapeToken, unescapeToken } from "./escape";
import type { ParsedFeatureBag, ParsedFeatureValue } from "./types";

const BOOLEAN_FEATURE_KEYS = new Set(["isClosedSet"]);
const YES_LITERAL_FEATURE_KEYS = new Set([
	"abbr",
	"foreign",
	"hyph",
	"isPhrasal",
	"lexicallyReflexive",
	"phrasal",
	"poss",
	"reflex",
	"separable",
]);
const MULTI_VALUE_FEATURE_KEYS = new Set([
	"gender",
	"gender[psor]",
	"pronType",
]);

export function compactFeatureBag(
	bag: Record<string, ParsedFeatureValue | undefined>,
): ParsedFeatureBag {
	return Object.fromEntries(
		Object.entries(bag).filter(([, value]) => value !== undefined),
	) as ParsedFeatureBag;
}

export function serializeFeatureBag(features: ParsedFeatureBag): string {
	const entries = Object.entries(features)
		.filter(([, value]) => value !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));

	if (entries.length === 0) {
		return "-";
	}

	return entries
		.map(
			([key, value]) =>
				`${escapeToken(key)}=${serializeFeatureValue(value)}`,
		)
		.join(",");
}

export function parseFeatureBag(token: string): ParsedFeatureBag {
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
	) as ParsedFeatureBag;
}

export function expectBooleanFeature(
	key: "isClosedSet",
	features: ParsedFeatureBag,
): boolean {
	const value = features[key];

	if (typeof value !== "boolean") {
		throw new Error(`Expected ${key} to deserialize as a boolean`);
	}

	return value;
}

export function expectYesLiteralFeature(
	key:
		| "abbr"
		| "foreign"
		| "hyph"
		| "isPhrasal"
		| "lexicallyReflexive"
		| "phrasal"
		| "poss"
		| "reflex"
		| "separable",
	features: ParsedFeatureBag,
): "Yes" {
	const value = features[key];

	if (value !== "Yes") {
		throw new Error(`Expected ${key} to deserialize as "Yes"`);
	}

	return value;
}

function serializeFeatureValue(value: ParsedFeatureValue): string {
	if (typeof value === "boolean") {
		return escapeToken(value ? "Yes" : "No");
	}

	if (Array.isArray(value)) {
		return `~${[...value]
			.sort()
			.map((part) => escapeToken(part))
			.join("|")}`;
	}

	return escapeToken(value as string);
}

function parseFeatureValue(key: string, value: string): ParsedFeatureValue {
	if (BOOLEAN_FEATURE_KEYS.has(key)) {
		if (value === "Yes" || value === "true") {
			return true;
		}

		if (value === "No" || value === "false") {
			return false;
		}

		throw new Error(`Malformed boolean feature value for ${key}: ${value}`);
	}

	if (YES_LITERAL_FEATURE_KEYS.has(key)) {
		if (value === "Yes") {
			return value;
		}

		throw new Error(
			`Malformed yes-literal feature value for ${key}: ${value}`,
		);
	}

	if (MULTI_VALUE_FEATURE_KEYS.has(key) && value.startsWith("~")) {
		return value.slice(1).split("|");
	}

	return value;
}
