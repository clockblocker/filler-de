import { splitPathCodec } from "../split-path-codec";
import type { AnySplitPath } from "../types/split-path";
import { type VaultAction, VaultActionKind } from "../types/vault-action";

/**
 * How an action's path meets a protected prefix: it lies `inside` the
 * protected subtree, or it is a folder that `contains` it, so renaming or
 * trashing that folder would carry the protected subtree with it.
 */
export type ProtectedPathRelation = "inside" | "contains";

export type ProtectedPathViolation = {
	readonly action: VaultAction;
	/** The action's system path that meets the prefix; `""` is the vault root. */
	readonly path: string;
	/** The configured prefix, as normalized. */
	readonly prefix: string;
	readonly relation: ProtectedPathRelation;
};

/** Trims slashes, turns `\` into `/`, and composes Unicode (NFC). */
function normalizePath(path: string): string {
	return path
		.normalize("NFC")
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}

/**
 * Case-insensitive, so a buggy action that spells the folder differently is
 * still refused: on the case-insensitive file systems of macOS and Windows,
 * `exemplar/x.md` lands in `Exemplar/`.
 */
function comparable(path: string): string {
	return normalizePath(path).toLowerCase();
}

/**
 * The vault paths VAM refuses to change. A prefix protects the file or folder
 * at that path and everything below it, matched by whole path segments:
 * `Exemplar` protects `Exemplar` and `Exemplar/Note.md`, not
 * `Exemplars/Note.md`.
 */
export class ProtectedPaths {
	/** Normalized prefixes, as configured. */
	readonly prefixes: readonly string[];
	private readonly keys: readonly string[];

	constructor(prefixes: readonly string[] = []) {
		const normalized: string[] = [];
		for (const raw of prefixes) {
			const prefix = normalizePath(raw);
			if (prefix === "") {
				throw new Error(
					`A protected path prefix cannot be the vault root (got ${JSON.stringify(raw)}): it would protect every path`,
				);
			}
			if (!normalized.includes(prefix)) normalized.push(prefix);
		}
		this.prefixes = normalized;
		this.keys = normalized.map((prefix) => prefix.toLowerCase());
	}

	get isEmpty(): boolean {
		return this.prefixes.length === 0;
	}

	/** The prefix protecting `path`, if `path` lies at or below one. */
	prefixCovering(path: string): string | undefined {
		const key = comparable(path);
		const index = this.keys.findIndex(
			(prefix) => key === prefix || key.startsWith(`${prefix}/`),
		);
		return index === -1 ? undefined : this.prefixes[index];
	}

	/**
	 * The prefix lying strictly below the folder at `path`, if any. The vault
	 * root `""` contains every prefix.
	 */
	prefixInside(path: string): string | undefined {
		const key = comparable(path);
		const index = this.keys.findIndex((prefix) =>
			key === "" ? true : prefix.startsWith(`${key}/`),
		);
		return index === -1 ? undefined : this.prefixes[index];
	}

	/** The first action in `actions` that would change a protected path. */
	findViolation(
		actions: readonly VaultAction[],
	): ProtectedPathViolation | undefined {
		if (this.isEmpty) return undefined;
		for (const action of actions) {
			const violation = this.violationOf(action);
			if (violation) return violation;
		}
		return undefined;
	}

	private violationOf(
		action: VaultAction,
	): ProtectedPathViolation | undefined {
		for (const splitPath of touchedPaths(action)) {
			const path = splitPathCodec.format(splitPath);
			const prefix = this.prefixCovering(path);
			if (prefix !== undefined) {
				return { action, path, prefix, relation: "inside" };
			}
		}
		const moved = movedFolder(action);
		if (moved) {
			const path = splitPathCodec.format(moved);
			const prefix = this.prefixInside(path);
			if (prefix !== undefined) {
				return { action, path, prefix, relation: "contains" };
			}
		}
		return undefined;
	}
}

/** Every path an action reads or writes: its target, or a rename's ends. */
function touchedPaths(action: VaultAction): readonly AnySplitPath[] {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameMdFile:
			return [action.payload.from, action.payload.to];
		case VaultActionKind.CreateFolder:
		case VaultActionKind.TrashFolder:
		case VaultActionKind.CreateFile:
		case VaultActionKind.TrashFile:
		case VaultActionKind.UpsertMdFile:
		case VaultActionKind.ProcessMdFile:
		case VaultActionKind.TrashMdFile:
			return [action.payload.splitPath];
	}
}

/**
 * The folder whose whole subtree an action moves or trashes. Creating a
 * folder above a protected prefix changes nothing below it, so it is allowed.
 */
function movedFolder(action: VaultAction): AnySplitPath | undefined {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
			return action.payload.from;
		case VaultActionKind.TrashFolder:
			return action.payload.splitPath;
		default:
			return undefined;
	}
}
