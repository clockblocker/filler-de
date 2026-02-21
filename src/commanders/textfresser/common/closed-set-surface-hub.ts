import { err, ok, type Result } from "neverthrow";
import { LANGUAGE_ISO_CODE } from "../../../linguistics/common/enums/core";
import type { DeLexemPos } from "../../../linguistics/de";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import {
	type AnySplitPath,
	SplitPathKind,
	type SplitPathToFolder,
	type SplitPathToMdFile,
} from "../../../managers/obsidian/vault-action-manager/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../managers/obsidian/vault-action-manager/types/vault-action";
import type { TargetLanguage } from "../../../types";
import type { PathLookupFn } from "./target-path-resolver";

export const CLOSED_SET_HUB_FOLDER = "closed-set-hub";

const CLOSED_SET_POS: ReadonlyArray<DeLexemPos> = [
	"Pronoun",
	"Article",
	"Preposition",
	"Conjunction",
	"Particle",
	"InteractionalUnit",
];

const CLOSED_SET_POS_KEBABS: ReadonlySet<string> = new Set(
	CLOSED_SET_POS.map((pos) => toPosKebab(pos)),
);

const POS_LABEL_BY_KEBAB: ReadonlyMap<string, DeLexemPos> = new Map(
	CLOSED_SET_POS.map((pos) => [toPosKebab(pos), pos]),
);

type HubActionsParams = {
	surface: string;
	targetLanguage: TargetLanguage;
	lookupInLibrary: PathLookupFn;
	vam: Pick<VaultActionManager, "exists">;
	currentClosedSetTarget?: SplitPathToMdFile | null;
};

type BackfillParams = {
	targetLanguage: TargetLanguage;
	lookupInLibrary: PathLookupFn;
	vam: Pick<
		VaultActionManager,
		"exists" | "list" | "listAllFilesWithMdReaders"
	>;
};

export function buildClosedSetSurfaceHubSplitPath(
	surface: string,
	targetLanguage: TargetLanguage,
): SplitPathToMdFile {
	const langCode = LANGUAGE_ISO_CODE[targetLanguage];
	const normalizedSurface = normalizeSurface(surface);

	return {
		basename: normalizedSurface,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: ["Worter", langCode, CLOSED_SET_HUB_FOLDER],
	};
}

export function isClosedSetLibraryTarget(
	splitPath: SplitPathToMdFile,
	targetLanguage: TargetLanguage,
): boolean {
	const langCode = LANGUAGE_ISO_CODE[targetLanguage];
	const root = splitPath.pathParts[0];
	const lang = splitPath.pathParts[1];
	const posSegment = splitPath.pathParts[2];

	return (
		root === "Library" &&
		lang === langCode &&
		typeof posSegment === "string" &&
		CLOSED_SET_POS_KEBABS.has(posSegment)
	);
}

export function extractSurfaceFromClosedSetTarget(
	splitPath: SplitPathToMdFile,
	targetLanguage: TargetLanguage,
): string | null {
	if (!isClosedSetLibraryTarget(splitPath, targetLanguage)) {
		return null;
	}

	const basename = splitPath.basename.trim();
	if (basename.length === 0) {
		return null;
	}

	const posSegment = splitPath.pathParts[2];
	if (typeof posSegment !== "string") {
		return null;
	}

	const langCode = LANGUAGE_ISO_CODE[targetLanguage];
	const suffix = `-${posSegment}-${langCode}`;
	const lowerBasename = basename.toLocaleLowerCase("de-DE");

	if (lowerBasename.endsWith(suffix)) {
		const surfaceCandidate = basename.slice(0, -suffix.length).trim();
		if (surfaceCandidate.length > 0) {
			return normalizeSurface(surfaceCandidate);
		}
	}

	// Fallback is intentional for non-standard/manual basenames:
	// treat the full basename as a surface candidate instead of dropping the entry.
	return normalizeSurface(basename);
}

export function buildClosedSetSurfaceHubContent(params: {
	surface: string;
	targetLanguage: TargetLanguage;
	targets: ReadonlyArray<SplitPathToMdFile>;
}): string {
	const normalizedSurface = normalizeSurface(params.surface);
	const sortedTargets = [...params.targets].sort((left, right) =>
		toPathString(left).localeCompare(toPathString(right), "en"),
	);

	const targetLines = sortedTargets.map((target) => {
		const label = formatPosLabel(target);
		const targetPath = toPathString(target);
		return `- [[${targetPath}|${normalizedSurface} (${label})]]`;
	});

	const disambiguationSection =
		targetLines.length > 0
			? `Possible closed-set targets:\n${targetLines.join("\n")}`
			: "No closed-set targets available.";

	return [
		"---",
		"textfresser:",
		"  kind: closed-set-surface-hub",
		`  surface: ${normalizedSurface}`,
		"---",
		`# ${normalizedSurface}`,
		"",
		disambiguationSection,
		"",
	].join("\n");
}

export function buildClosedSetSurfaceHubActions(
	params: HubActionsParams,
): VaultAction[] {
	const normalizedSurface = normalizeSurface(params.surface);
	if (normalizedSurface.length === 0) {
		return [];
	}

	const hubPath = buildClosedSetSurfaceHubSplitPath(
		normalizedSurface,
		params.targetLanguage,
	);
	const hubExists = params.vam.exists(hubPath);

	const targets = collectClosedSetTargetsForSurface({
		currentClosedSetTarget: params.currentClosedSetTarget,
		lookupInLibrary: params.lookupInLibrary,
		surface: normalizedSurface,
		targetLanguage: params.targetLanguage,
	});

	if (targets.length === 0) {
		if (!hubExists) {
			return [];
		}
		return [
			{
				kind: VaultActionKind.TrashMdFile,
				payload: { splitPath: hubPath },
			},
		];
	}

	if (targets.length === 1 && !hubExists) {
		return [];
	}

	const content = buildClosedSetSurfaceHubContent({
		surface: normalizedSurface,
		targetLanguage: params.targetLanguage,
		targets,
	});

	return [
		{
			kind: VaultActionKind.UpsertMdFile,
			payload: {
				content,
				splitPath: hubPath,
			},
		},
	];
}

export async function buildClosedSetSurfaceHubBackfillActions(
	params: BackfillParams,
): Promise<Result<VaultAction[], string>> {
	const librarySurfacesResult = collectClosedSetSurfacesFromLibrary(
		params.vam,
		params.targetLanguage,
	);
	if (librarySurfacesResult.isErr()) {
		return err(librarySurfacesResult.error);
	}

	const existingHubSurfacesResult = collectExistingHubSurfaces(
		params.vam,
		params.targetLanguage,
	);
	if (existingHubSurfacesResult.isErr()) {
		return err(existingHubSurfacesResult.error);
	}

	const allSurfaces = dedupeStrings([
		...librarySurfacesResult.value,
		...existingHubSurfacesResult.value,
	]);
	const existingHubContentResult = await collectExistingHubContentByPath(
		params.vam,
		params.targetLanguage,
	);
	if (existingHubContentResult.isErr()) {
		return err(existingHubContentResult.error);
	}

	const actions: VaultAction[] = [];
	for (const surface of allSurfaces) {
		actions.push(
			...buildClosedSetSurfaceHubActions({
				lookupInLibrary: params.lookupInLibrary,
				surface,
				targetLanguage: params.targetLanguage,
				vam: params.vam,
			}),
		);
	}

	const idempotentActions = actions.filter((action) => {
		if (action.kind !== VaultActionKind.UpsertMdFile) {
			return true;
		}

		const splitPath = action.payload.splitPath;
		const existingContent = existingHubContentResult.value.get(
			toPathString(splitPath),
		);
		return existingContent !== action.payload.content;
	});

	return ok(idempotentActions);
}

function collectClosedSetSurfacesFromLibrary(
	vam: Pick<VaultActionManager, "exists" | "listAllFilesWithMdReaders">,
	targetLanguage: TargetLanguage,
): Result<string[], string> {
	const folder = buildLibraryLanguageFolder(targetLanguage);
	if (!vam.exists(folder)) {
		return ok([]);
	}

	const listed = vam.listAllFilesWithMdReaders(folder);
	if (listed.isErr()) {
		return err(listed.error);
	}

	const surfaces: string[] = [];
	for (const splitPath of listed.value) {
		if (splitPath.kind !== SplitPathKind.MdFile) {
			continue;
		}
		if (!isClosedSetLibraryTarget(splitPath, targetLanguage)) {
			continue;
		}
		const surface = extractSurfaceFromClosedSetTarget(
			splitPath,
			targetLanguage,
		);
		if (!surface) {
			continue;
		}
		surfaces.push(surface);
	}

	return ok(dedupeStrings(surfaces));
}

function collectExistingHubSurfaces(
	vam: Pick<VaultActionManager, "exists" | "list">,
	targetLanguage: TargetLanguage,
): Result<string[], string> {
	const folder = buildClosedSetHubFolder(targetLanguage);
	if (!vam.exists(folder)) {
		return ok([]);
	}

	const listed = vam.list(folder);
	if (listed.isErr()) {
		return err(listed.error);
	}

	const surfaces: string[] = [];
	for (const splitPath of listed.value) {
		if (splitPath.kind !== SplitPathKind.MdFile) {
			continue;
		}
		surfaces.push(normalizeSurface(splitPath.basename));
	}

	return ok(dedupeStrings(surfaces));
}

function buildLibraryLanguageFolder(
	targetLanguage: TargetLanguage,
): SplitPathToFolder {
	return {
		basename: LANGUAGE_ISO_CODE[targetLanguage],
		kind: SplitPathKind.Folder,
		pathParts: ["Library"],
	};
}

function buildClosedSetHubFolder(
	targetLanguage: TargetLanguage,
): SplitPathToFolder {
	return {
		basename: CLOSED_SET_HUB_FOLDER,
		kind: SplitPathKind.Folder,
		pathParts: ["Worter", LANGUAGE_ISO_CODE[targetLanguage]],
	};
}

function collectClosedSetTargetsForSurface(params: {
	surface: string;
	targetLanguage: TargetLanguage;
	lookupInLibrary: PathLookupFn;
	currentClosedSetTarget?: SplitPathToMdFile | null;
}): SplitPathToMdFile[] {
	const normalizedSurface = normalizeSurface(params.surface);
	if (normalizedSurface.length === 0) {
		return [];
	}

	const candidates = buildSurfaceLookupCandidates(params.surface);
	const fromLookup: SplitPathToMdFile[] = [];
	for (const candidate of candidates) {
		fromLookup.push(...params.lookupInLibrary(candidate));
	}

	if (params.currentClosedSetTarget) {
		fromLookup.push(params.currentClosedSetTarget);
	}

	const filtered = fromLookup.filter((splitPath) => {
		const surface = extractSurfaceFromClosedSetTarget(
			splitPath,
			params.targetLanguage,
		);
		return surface === normalizedSurface;
	});

	return dedupeSplitPaths(filtered);
}

function dedupeSplitPaths(
	splitPaths: ReadonlyArray<SplitPathToMdFile>,
): SplitPathToMdFile[] {
	const unique: SplitPathToMdFile[] = [];
	const seen = new Set<string>();
	for (const splitPath of splitPaths) {
		const key = toPathString(splitPath);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(splitPath);
	}
	return unique;
}

async function collectExistingHubContentByPath(
	vam: Pick<VaultActionManager, "exists" | "listAllFilesWithMdReaders">,
	targetLanguage: TargetLanguage,
): Promise<Result<Map<string, string>, string>> {
	const folder = buildClosedSetHubFolder(targetLanguage);
	if (!vam.exists(folder)) {
		return ok(new Map());
	}

	const listed = vam.listAllFilesWithMdReaders(folder);
	if (listed.isErr()) {
		return err(listed.error);
	}

	const contentByPath = new Map<string, string>();
	for (const splitPath of listed.value) {
		if (splitPath.kind !== SplitPathKind.MdFile) {
			continue;
		}

		const readResult = await splitPath.read();
		if (readResult.isErr()) {
			return err(
				`Failed to read existing hub ${toPathString(splitPath)}: ${readResult.error.reason}`,
			);
		}

		contentByPath.set(toPathString(splitPath), readResult.value);
	}

	return ok(contentByPath);
}

function dedupeStrings(values: ReadonlyArray<string>): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = value.trim();
		if (trimmed.length === 0) {
			continue;
		}
		if (seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		out.push(trimmed);
	}
	return out.sort((left, right) => left.localeCompare(right, "en"));
}

function buildSurfaceLookupCandidates(surface: string): string[] {
	const trimmed = surface.trim();
	const normalized = normalizeSurface(surface);
	const capitalized = capitalizeFirst(normalized);
	return dedupeStrings([trimmed, normalized, capitalized]);
}

function formatPosLabel(splitPath: SplitPathToMdFile): string {
	const posSegment = splitPath.pathParts[2];
	if (typeof posSegment !== "string") {
		return "Unknown";
	}
	const mapped = POS_LABEL_BY_KEBAB.get(posSegment);
	return mapped ?? posSegment;
}

function toPathString(
	splitPath: Pick<AnySplitPath, "basename" | "pathParts">,
): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}

function normalizeSurface(surface: string): string {
	return surface.trim().toLocaleLowerCase("de-DE");
}

function capitalizeFirst(value: string): string {
	const first = value.charAt(0);
	if (first.length === 0) {
		return value;
	}
	return `${first.toLocaleUpperCase("de-DE")}${value.slice(1)}`;
}

function toPosKebab(pos: DeLexemPos): string {
	return pos.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
