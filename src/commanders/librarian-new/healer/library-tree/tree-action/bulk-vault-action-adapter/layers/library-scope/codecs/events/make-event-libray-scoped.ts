import {
	type VaultEvent,
	VaultEventKind,
} from "../../../../../../../../../../managers/obsidian/vault-action-manager";
import { visitEvent } from "../../../../../../../../../../managers/obsidian/vault-action-manager/helpers/event-helpers";
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
	const splitPathResult = tryParseAsInsideLibrarySplitPath(
		event.splitPath,
		rules,
	);
	if (splitPathResult.isErr()) {
		return {
			scope: Scope.Outside,
			...event,
		} as EnscopedEvent<E>;
	}
	return {
		...event,
		scope: Scope.Inside,
		splitPath: splitPathResult.value,
	} as EnscopedEvent<E>;
}

/**
 * Scopes a rename event based on whether from/to paths are inside the library.
 * Determines the crossing type: Inside, Outside, InsideToOutside, OutsideToInside.
 */
function scopeRenameEvent<E extends VaultEvent & { from: unknown; to: unknown }>(
	event: E,
	rules: CodecRules,
): EnscopedEvent<E> {
	const fromResult = tryParseAsInsideLibrarySplitPath(event.from, rules);
	const toResult = tryParseAsInsideLibrarySplitPath(event.to, rules);

	const fromInside = fromResult.isOk();
	const toInside = toResult.isOk();

	if (fromInside && toInside) {
		return {
			from: fromResult.value,
			kind: event.kind,
			scope: Scope.Inside,
			to: toResult.value,
		} as EnscopedEvent<E>;
	}

	if (fromInside && !toInside) {
		return {
			from: fromResult.value,
			kind: event.kind,
			scope: Scope.InsideToOutside,
			to: event.to,
		} as EnscopedEvent<E>;
	}

	if (!fromInside && toInside) {
		return {
			from: event.from,
			kind: event.kind,
			scope: Scope.OutsideToInside,
			to: toResult.value,
		} as EnscopedEvent<E>;
	}

	return {
		...event,
		scope: Scope.Outside,
	} as EnscopedEvent<E>;
}

export function makeEventLibraryScoped(
	event: VaultEvent,
	rules: CodecRules,
): EnscopedEvent<VaultEvent> {
	return visitEvent(event, {
		FileCreated: (e) => scopeSimpleEvent(e, rules),
		FileDeleted: (e) => scopeSimpleEvent(e, rules),
		FolderCreated: (e) => scopeSimpleEvent(e, rules),
		FolderDeleted: (e) => scopeSimpleEvent(e, rules),
		FileRenamed: (e) => scopeRenameEvent(e, rules),
		FolderRenamed: (e) => scopeRenameEvent(e, rules),
	});
}
