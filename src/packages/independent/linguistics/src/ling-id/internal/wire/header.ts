import type { TargetLanguage } from "../../../lu/universal/enums/core/language";
import type { ConcreteLingIdKind } from "../../types";
import { codeToLanguage, languageToCode } from "./language-codes";

export type WireKindCode = "LEM" | "SEL" | "SURF-RES" | "SURF-UNRES";

const KIND_TO_WIRE = {
	Lemma: "LEM",
	ResolvedSurface: "SURF-RES",
	Selection: "SEL",
	UnresolvedSurface: "SURF-UNRES",
} as const satisfies Record<ConcreteLingIdKind, WireKindCode>;

const WIRE_TO_KIND = {
	LEM: "Lemma",
	SEL: "Selection",
	"SURF-RES": "ResolvedSurface",
	"SURF-UNRES": "UnresolvedSurface",
} as const satisfies Record<WireKindCode, ConcreteLingIdKind>;

export function encodeWireKind(kind: ConcreteLingIdKind): WireKindCode {
	return KIND_TO_WIRE[kind];
}

export function decodeWireKind(
	wireKind: string,
): ConcreteLingIdKind | undefined {
	return (WIRE_TO_KIND as Record<string, ConcreteLingIdKind | undefined>)[
		wireKind
	];
}

export function buildHeader(
	language: TargetLanguage,
	kind: ConcreteLingIdKind,
): string {
	return `ling:v1:${languageToCode(language)}:${encodeWireKind(kind)}`;
}

export function parseHeader(id: string): {
	body: string;
	kind: ConcreteLingIdKind;
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

	const [namespace, version, languageCode, wireKind] = headerParts as [
		string,
		string,
		string,
		string,
	];

	if (namespace !== "ling") {
		throw new Error(`Malformed Ling ID namespace: ${namespace}`);
	}

	if (version !== "v1") {
		throw new Error(`Unsupported Ling ID version: ${version}`);
	}

	const language = codeToLanguage(languageCode);

	if (language === undefined) {
		throw new Error(
			`Unsupported language code in Ling ID: ${languageCode}`,
		);
	}

	const kind = decodeWireKind(wireKind);

	if (kind === undefined) {
		throw new Error(`Unsupported Ling ID kind: ${wireKind}`);
	}

	return { body, kind, language };
}
