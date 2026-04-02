import type {
	BuildDictEntryIdParts,
	ParsedDictEntryId,
} from "../../domain/dict-entry-id";
import { dictEntryIdHelper } from "../../domain/dict-entry-id";
import type {
	LinguisticUnitKind,
	POS,
	SurfaceKind,
} from "src/packages/independent/old-linguistics/src";

function buildPrefix(
	unitKind: LinguisticUnitKind,
	surfaceKind: SurfaceKind,
	pos?: POS,
): string {
	return dictEntryIdHelper.buildPrefix(unitKind, surfaceKind, pos);
}

function nextIndex(existingIds: readonly string[], prefix: string): number {
	return dictEntryIdHelper.nextIndex(existingIds, prefix);
}

function parse(id: string): ParsedDictEntryId | undefined {
	return dictEntryIdHelper.parse(id);
}

function build(parts: BuildDictEntryIdParts): string {
	return dictEntryIdHelper.build(parts);
}

export const entryIdentity = {
	build,
	buildPrefix,
	nextIndex,
	parse,
} as const;

export type { BuildDictEntryIdParts, ParsedDictEntryId };
