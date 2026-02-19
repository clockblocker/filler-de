import { dedupeByKeyFirst } from "../../../../utils/array-utils";
import type {
	InflectionItemDto,
	MorphologyBacklinkDto,
	MorphologyEquationDto,
	RelationItemDto,
} from "./types";

export function normalizeSpace(value: string): string {
	return value.trim().replace(/\s+/g, " ");
}

export function normalizeCaseFold(value: string): string {
	return normalizeSpace(value).toLowerCase();
}

export function normalizeTagToken(value: string): string {
	return normalizeCaseFold(value).replace(/\s+/g, "-");
}

export { dedupeByKeyFirst as dedupeByKey };

export function relationItemIdentityKey(item: RelationItemDto): string {
	return `${normalizeCaseFold(item.relationKind)}::${normalizeCaseFold(item.targetLemma)}`;
}

export function morphologyBacklinkIdentityKey(
	item: MorphologyBacklinkDto,
): string {
	return `${item.relationType}::${normalizeCaseFold(item.value)}`;
}

export function morphologyEquationIdentityKey(
	item: MorphologyEquationDto,
): string {
	const lhs = item.lhsParts.map((part) => normalizeCaseFold(part)).join("+");
	return `${lhs}=>${normalizeCaseFold(item.rhs)}`;
}

export function inflectionItemIdentityKey(item: InflectionItemDto): string {
	return normalizeCaseFold(item.form);
}
