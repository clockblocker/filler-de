import type { CodecRules } from "../../../../../../../../codecs/rules";
import type { AnySplitPathInsideLibrary } from "../../../../../../../../codecs/split-path-inside-library/types/split-path-inside-library";
import { visitInsideEvent } from "../../helpers/scoped-event-helpers";
import type { DescopedEvent } from "../../types/generics/scoped-event";
import type { LibraryScopedVaultEvent } from "../../types/scoped-event";
import { makeVaultScopedSplitPath } from "../split-path-inside-the-library";

/**
 * Descopes a simple (non-rename) event by converting the library-scoped path back to vault path.
 */
function descopeSimpleEvent<E extends { kind: string; splitPath: unknown }>(
	event: E,
	rules: CodecRules,
): DescopedEvent<LibraryScopedVaultEvent> {
	// Cast through AnySplitPathInsideLibrary - splitPath is unknown but we know it's a valid inside-library path
	return {
		kind: event.kind,
		splitPath: makeVaultScopedSplitPath(
			event.splitPath as AnySplitPathInsideLibrary,
			rules,
		),
	} as DescopedEvent<LibraryScopedVaultEvent>;
}

/**
 * Descopes an inside rename event (both from/to inside library).
 */
function descopeRenameInside<
	E extends { kind: string; from: unknown; to: unknown },
>(event: E, rules: CodecRules): DescopedEvent<LibraryScopedVaultEvent> {
	// Cast through AnySplitPathInsideLibrary - from/to are unknown but we know they're valid inside-library paths
	return {
		from: makeVaultScopedSplitPath(
			event.from as AnySplitPathInsideLibrary,
			rules,
		),
		kind: event.kind,
		to: makeVaultScopedSplitPath(
			event.to as AnySplitPathInsideLibrary,
			rules,
		),
	} as DescopedEvent<LibraryScopedVaultEvent>;
}

/**
 * Descopes an InsideToOutside rename event (from inside, to outside).
 */
function descopeRenameInsideToOutside<
	E extends { kind: string; from: unknown; to: unknown },
>(event: E, rules: CodecRules): DescopedEvent<LibraryScopedVaultEvent> {
	// Cast through AnySplitPathInsideLibrary - from is inside library, to stays as-is
	return {
		from: makeVaultScopedSplitPath(
			event.from as AnySplitPathInsideLibrary,
			rules,
		),
		kind: event.kind,
		to: event.to, // outside path stays as-is
	} as DescopedEvent<LibraryScopedVaultEvent>;
}

/**
 * Descopes an OutsideToInside rename event (from outside, to inside).
 */
function descopeRenameOutsideToInside<
	E extends { kind: string; from: unknown; to: unknown },
>(event: E, rules: CodecRules): DescopedEvent<LibraryScopedVaultEvent> {
	// Cast through AnySplitPathInsideLibrary - to is inside library, from stays as-is
	return {
		from: event.from, // outside path stays as-is
		kind: event.kind,
		to: makeVaultScopedSplitPath(
			event.to as AnySplitPathInsideLibrary,
			rules,
		),
	} as DescopedEvent<LibraryScopedVaultEvent>;
}

export function makeEventVaultScoped(
	event: LibraryScopedVaultEvent,
	rules: CodecRules,
): DescopedEvent<LibraryScopedVaultEvent> {
	return visitInsideEvent(event, {
		// Simple events
		FileCreated: (e) => descopeSimpleEvent(e, rules),
		FileDeleted: (e) => descopeSimpleEvent(e, rules),

		// Inside renames
		FileRenamed: (e) => descopeRenameInside(e, rules),

		// Boundary crossing renames
		FileRenamedInsideToOutside: (e) =>
			descopeRenameInsideToOutside(e, rules),

		FileRenamedOutsideToInside: (e) =>
			descopeRenameOutsideToInside(e, rules),

		FolderCreated: (e) => descopeSimpleEvent(e, rules),
		FolderDeleted: (e) => descopeSimpleEvent(e, rules),
		FolderRenamed: (e) => descopeRenameInside(e, rules),
		FolderRenamedInsideToOutside: (e) =>
			descopeRenameInsideToOutside(e, rules),
		FolderRenamedOutsideToInside: (e) =>
			descopeRenameOutsideToInside(e, rules),

		// Outside events - strip scope, keep rest
		Outside: (e) => {
			const { scope: _scope, ...rest } = e;
			return rest as DescopedEvent<LibraryScopedVaultEvent>;
		},
	});
}
