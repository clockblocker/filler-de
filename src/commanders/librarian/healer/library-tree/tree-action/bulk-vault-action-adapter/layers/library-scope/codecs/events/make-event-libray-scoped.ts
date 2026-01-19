import type { VaultEvent } from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import { visitEvent } from "../../../../../../../../../../managers/obsidian/vault-action-manager/helpers/event-helpers";
import type { AnySplitPath } from "../../../../../../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecRules } from "../../../../../../../../codecs/rules";
import type { EnscopedEvent } from "../../types/generics";
import { Scope } from "../../types/scoped-event";
import { tryParseAsInsideLibrarySplitPath } from "../split-path-inside-the-library";

/**
 * Scopes a simple (non-rename) event based on whether its path is inside the library.
 */
function scopeSimpleEvent<E extends VaultEvent & { splitPath: unknown }>(
	event: E,
	rules: CodecRules,
): EnscopedEvent<E> {
	// Cast through AnySplitPath - event.splitPath is unknown but we know it's a valid split path
	const splitPathResult = tryParseAsInsideLibrarySplitPath(
		event.splitPath as AnySplitPath,
		rules,
	);
	if (splitPathResult.isErr()) {
		return {
			scope: Scope.Outside,
			...event,
		} as unknown as EnscopedEvent<E>;
	}
	return {
		...event,
		scope: Scope.Inside,
		splitPath: splitPathResult.value,
	} as unknown as EnscopedEvent<E>;
}

/**
 * Scopes a rename event based on whether from/to paths are inside the library.
 * Determines the crossing type: Inside, Outside, InsideToOutside, OutsideToInside.
 */
function scopeRenameEvent<
	E extends VaultEvent & { from: unknown; to: unknown },
>(event: E, rules: CodecRules): EnscopedEvent<E> {
	// Cast through AnySplitPath - from/to are unknown but we know they're valid split paths
	const fromResult = tryParseAsInsideLibrarySplitPath(
		event.from as AnySplitPath,
		rules,
	);
	const toResult = tryParseAsInsideLibrarySplitPath(
		event.to as AnySplitPath,
		rules,
	);

	const fromInside = fromResult.isOk();
	const toInside = toResult.isOk();

	if (fromInside && toInside) {
		return {
			from: fromResult.value,
			kind: event.kind,
			scope: Scope.Inside,
			to: toResult.value,
		} as unknown as EnscopedEvent<E>;
	}

	if (fromInside && !toInside) {
		return {
			from: fromResult.value,
			kind: event.kind,
			scope: Scope.InsideToOutside,
			to: event.to,
		} as unknown as EnscopedEvent<E>;
	}

	if (!fromInside && toInside) {
		return {
			from: event.from,
			kind: event.kind,
			scope: Scope.OutsideToInside,
			to: toResult.value,
		} as unknown as EnscopedEvent<E>;
	}

	return {
		...event,
		scope: Scope.Outside,
	} as unknown as EnscopedEvent<E>;
}

export function makeEventLibraryScoped(
	event: VaultEvent,
	rules: CodecRules,
): EnscopedEvent<VaultEvent> {
	// visitEvent handlers return specific EnscopedEvent types that together form EnscopedEvent<VaultEvent>
	// Each callback is typed to return the shared union type to satisfy the visitor pattern
	type ScopedResult = EnscopedEvent<VaultEvent>;
	return visitEvent(event, {
		FileCreated: (e) => scopeSimpleEvent(e, rules) as ScopedResult,
		FileDeleted: (e) => scopeSimpleEvent(e, rules) as ScopedResult,
		FileRenamed: (e) => scopeRenameEvent(e, rules) as ScopedResult,
		FolderCreated: (e) => scopeSimpleEvent(e, rules) as ScopedResult,
		FolderDeleted: (e) => scopeSimpleEvent(e, rules) as ScopedResult,
		FolderRenamed: (e) => scopeRenameEvent(e, rules) as ScopedResult,
	});
}
