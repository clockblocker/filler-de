import type { TargetLanguage } from "../lu/universal/enums/core/language";

export type LingIdKind = "SURF" | "SURF-SHALLOW";

const LANGUAGE_TO_CODE = {
	English: "EN",
	German: "DE",
} as const satisfies Record<TargetLanguage, string>;

const CODE_TO_LANGUAGE = {
	DE: "German",
	EN: "English",
} as const satisfies Record<string, TargetLanguage>;

export function buildHeader(
	language: TargetLanguage,
	kind: LingIdKind,
): string {
	return `ling:v1:${LANGUAGE_TO_CODE[language]}:${kind}`;
}

export function parseHeader(id: string): {
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
	const headerParts = header.split(":");

	if (headerParts.length !== 4) {
		throw new Error(`Malformed Ling ID header: ${header}`);
	}

	const [namespace, version, languageCode, kind] = headerParts as [
		string,
		string,
		string,
		string,
	];

	if (namespace !== "ling" || version !== "v1") {
		throw new Error(`Unsupported Ling ID prefix: ${header}`);
	}

	const language = (
		CODE_TO_LANGUAGE as Record<string, TargetLanguage | undefined>
	)[languageCode];

	if (language === undefined) {
		throw new Error(
			`Unsupported language code in Ling ID: ${languageCode}`,
		);
	}

	if (kind !== "SURF" && kind !== "SURF-SHALLOW") {
		throw new Error(`Unsupported Ling ID kind: ${kind}`);
	}

	return { body, kind, language };
}

export function joinLingId(parts: string[]): string {
	return `${parts[0]};${parts.slice(1).join(";")}`;
}
