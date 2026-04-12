import type {
	LexicalFeatures,
	LexicalInfo,
	ResolvedSelection,
} from "@textfresser/lexical-generation";
import { isLexicalGenus } from "./lexical-types";
import {
	getSelectionPos,
	getSelectionSurfaceKind,
	getSelectionUnitKind,
	getSpelledLemma,
	isKnownSelection,
	isLexemeSelection,
	isPhrasemeSelection,
} from "./native-selection";

export function getLexicalInfoSelection(info: LexicalInfo): ResolvedSelection {
	return info.selection;
}

export function getLexicalInfoLemma(info: LexicalInfo): string | undefined {
	return getSpelledLemma(info.selection);
}

export function getLexicalInfoPos(info: LexicalInfo) {
	return getSelectionPos(info.selection);
}

export function getLexicalInfoUnitKind(info: LexicalInfo) {
	return getSelectionUnitKind(info.selection);
}

export function getLexicalInfoSurfaceKind(info: LexicalInfo) {
	return getSelectionSurfaceKind(info.selection);
}

export function isLexicalInfoLexeme(info: LexicalInfo) {
	return isLexemeSelection(info.selection);
}

export function isLexicalInfoPhraseme(info: LexicalInfo) {
	return isPhrasemeSelection(info.selection);
}

export function getLexicalInfoInherentFeatures(
	info: LexicalInfo,
): LexicalFeatures["inherentFeatures"] | undefined {
	return info.features.status === "ready"
		? info.features.value.inherentFeatures
		: undefined;
}

export function getLexicalInfoGender(info: LexicalInfo) {
	const inherentFeatures = getLexicalInfoInherentFeatures(info);
	if (inherentFeatures?.gender && isLexicalGenus(inherentFeatures.gender)) {
		return inherentFeatures.gender;
	}

	if (
		info.inflections.status === "ready" &&
		info.inflections.value.kind === "noun" &&
		isLexicalGenus(info.inflections.value.gender)
	) {
		return info.inflections.value.gender;
	}

	return undefined;
}

export function isKnownLexicalInfo(info: LexicalInfo) {
	return isKnownSelection(info.selection);
}
