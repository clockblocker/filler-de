import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import type {
	LinguisticWikilinkIntent,
	LinguisticWikilinkSource,
	LinguisticWikilinkTargetKind,
} from "../../common/linguistic-wikilink-context";

export type ParsedLibraryBasename = {
	coreName: string;
	suffixParts: string[];
};

export type LibraryBasenameParser = (
	basename: string,
) => ParsedLibraryBasename | null;

export type LibraryLookupByCoreName = (coreName: string) => SplitPathToMdFile[];

export type LibraryLeafTargetRef = {
	kind: "LibraryLeaf";
	basename: string;
	coreName: string;
	suffixParts: string[];
};

export type WorterNoteTargetRef = {
	kind: "WorterNote";
	basename: string;
	surfaceKind: Exclude<LinguisticWikilinkTargetKind, "None">;
};

export type UnresolvedTargetRef = {
	kind: "Unresolved";
	target: string;
};

export type LinguisticWikilinkTargetRef =
	| LibraryLeafTargetRef
	| WorterNoteTargetRef
	| UnresolvedTargetRef;

export type LinguisticWikilinkDto = {
	alias: string | null;
	anchor: string | null;
	fullMatch: string;
	intent: LinguisticWikilinkIntent;
	sectionCssKind: string;
	source: LinguisticWikilinkSource;
	surface: string;
	target: string;
	targetKind: LinguisticWikilinkTargetKind;
	targetRef: LinguisticWikilinkTargetRef;
};
