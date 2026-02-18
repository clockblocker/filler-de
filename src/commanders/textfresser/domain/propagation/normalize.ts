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

export function dedupeByKey<T>(
	items: ReadonlyArray<T>,
	getKey: (item: T) => string,
): T[] {
	const seen = new Set<string>();
	const deduped: T[] = [];
	for (const item of items) {
		const key = getKey(item);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(item);
	}
	return deduped;
}

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
