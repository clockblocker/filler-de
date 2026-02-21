import type { SplitPathToMdFile } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import { stringifySplitPath } from "../../../../stateless-helpers/split-path-comparison";
import {
	wikilinkHelper,
	type ParsedWikilink,
} from "../../../../stateless-helpers/wikilink";
import {
	resolveSectionLinkPolicyForCssKind,
} from "../../common/linguistic-wikilink-context";
import type {
	LibraryBasenameParser,
	LibraryLookupByCoreName,
	LinguisticWikilinkDto,
	ParsedLibraryBasename,
} from "./types";

export type ParseLinguisticWikilinksParams = {
	content: string;
	sectionCssKind: string;
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
};

export function parseLinguisticWikilinks(
	params: ParseLinguisticWikilinksParams,
): LinguisticWikilinkDto[] {
	const policy = resolveSectionLinkPolicyForCssKind(params.sectionCssKind);
	const parsedLinks = wikilinkHelper.parse(params.content);

	return parsedLinks.map((parsed) => {
		const { anchor, baseTarget } = splitAnchor(parsed.target);
		const targetRef = resolveTargetRef({
			baseTarget,
			rawTarget: parsed.target,
			lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
			parseLibraryBasename: params.parseLibraryBasename,
			targetKind: policy.targetKind,
		});

		return {
			alias: parsed.alias,
			anchor,
			fullMatch: parsed.fullMatch,
			intent: policy.sectionIntent,
			sectionCssKind: params.sectionCssKind,
			source: policy.source,
			surface: parsed.surface,
			target: parsed.target,
			targetKind: policy.targetKind,
			targetRef,
		};
	});
}

function resolveTargetRef(params: {
	baseTarget: string;
	rawTarget: string;
	targetKind: LinguisticWikilinkDto["targetKind"];
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
}): LinguisticWikilinkDto["targetRef"] {
	const explicitPath = parseExplicitPath(params.baseTarget);
	if (explicitPath) {
		if (explicitPath.pathParts[0] === "Library") {
			return buildLibraryLeafRef({
				basename: explicitPath.basename,
				parseLibraryBasename: params.parseLibraryBasename,
				pathParts: explicitPath.pathParts,
			});
		}

		if (explicitPath.pathParts[0] === "Worter") {
			if (params.targetKind === "None") {
				return {
					kind: "Unresolved",
					target: params.rawTarget,
				};
			}
			return {
				basename: explicitPath.basename,
				kind: "WorterNote",
				surfaceKind: params.targetKind,
			};
		}
	}

	const normalizedBasename = normalizeBasename(params.baseTarget);
	if (normalizedBasename.length === 0) {
		return {
			kind: "Unresolved",
			target: params.rawTarget,
		};
	}
	const resolvedLibraryLeaf = resolveLibraryLeafByBasename({
		basename: normalizedBasename,
		lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
		parseLibraryBasename: params.parseLibraryBasename,
	});
	if (resolvedLibraryLeaf) {
		return resolvedLibraryLeaf;
	}

	if (params.targetKind === "None") {
		return {
			kind: "Unresolved",
			target: params.rawTarget,
		};
	}

	return {
		basename: normalizedBasename,
		kind: "WorterNote",
		surfaceKind: params.targetKind,
	};
}

function resolveLibraryLeafByBasename(params: {
	basename: string;
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
}): LinguisticWikilinkDto["targetRef"] | null {
	const parsed = params.parseLibraryBasename?.(params.basename) ?? null;
	const lookup = params.lookupInLibraryByCoreName;

	let matchedSplitPath: SplitPathToMdFile | null = null;
	let matchedCoreName: string | null = parsed?.coreName ?? null;

	if (lookup) {
		for (const coreCandidate of buildCoreNameCandidates(params.basename, parsed)) {
			const exactMatches = lookup(coreCandidate).filter(
				(splitPath) => splitPath.basename === params.basename,
			);
			if (exactMatches.length === 0) {
				continue;
			}

			const sortedExactMatches = [...exactMatches].sort((left, right) =>
				stringifySplitPath(left).localeCompare(
					stringifySplitPath(right),
					"en",
				),
			);
			matchedSplitPath = sortedExactMatches[0] ?? null;
			matchedCoreName = coreCandidate;
			break;
		}
	}

	if (matchedSplitPath) {
		return buildLibraryLeafRef({
			basename: matchedSplitPath.basename,
			coreNameHint: matchedCoreName ?? undefined,
			parsedBasename: parsed,
			parseLibraryBasename: params.parseLibraryBasename,
			pathParts: matchedSplitPath.pathParts,
		});
	}

	if (parsed && parsed.suffixParts.length > 0) {
		return {
			basename: params.basename,
			coreName: parsed.coreName,
			kind: "LibraryLeaf",
			suffixParts: parsed.suffixParts,
		};
	}

	return null;
}

function buildCoreNameCandidates(
	basename: string,
	parsed: ParsedLibraryBasename | null,
): string[] {
	const candidates = new Set<string>();
	const trimmed = basename.trim();
	if (trimmed.length > 0) {
		candidates.add(trimmed);
	}

	if (parsed?.coreName) {
		candidates.add(parsed.coreName.trim());
	}

	const hyphenIndex = trimmed.indexOf("-");
	if (hyphenIndex > 0) {
		candidates.add(trimmed.slice(0, hyphenIndex).trim());
	}

	const output: string[] = [];
	for (const candidate of candidates) {
		if (candidate.length === 0) {
			continue;
		}
		output.push(candidate);

		const firstChar = candidate.charAt(0);
		const decapitalized =
			firstChar.toLocaleLowerCase("de-DE") + candidate.slice(1);
		if (decapitalized !== candidate) {
			output.push(decapitalized);
		}
	}

	return dedupeStrings(output);
}

function buildLibraryLeafRef(params: {
	basename: string;
	pathParts: string[];
	parsedBasename?: ParsedLibraryBasename | null;
	parseLibraryBasename?: LibraryBasenameParser;
	coreNameHint?: string;
}): LinguisticWikilinkDto["targetRef"] {
	const parsed =
		params.parsedBasename ??
		params.parseLibraryBasename?.(params.basename) ??
		null;
	if (parsed && parsed.suffixParts.length > 0) {
		return {
			basename: params.basename,
			coreName: parsed.coreName,
			kind: "LibraryLeaf",
			suffixParts: parsed.suffixParts,
		};
	}

	const suffixPartsFromPath = params.pathParts.slice(1).reverse();
	const coreName =
		params.coreNameHint ??
		inferCoreNameFromBasenameAndSuffix(params.basename, suffixPartsFromPath);

	return {
		basename: params.basename,
		coreName,
		kind: "LibraryLeaf",
		suffixParts: suffixPartsFromPath,
	};
}

function inferCoreNameFromBasenameAndSuffix(
	basename: string,
	suffixParts: string[],
): string {
	if (suffixParts.length === 0) {
		return basename;
	}

	const suffix = suffixParts.join("-");
	const suffixToken = `-${suffix}`;
	if (!basename.endsWith(suffixToken)) {
		return basename;
	}

	const withoutSuffix = basename.slice(0, -suffixToken.length).trim();
	return withoutSuffix.length > 0 ? withoutSuffix : basename;
}

function splitAnchor(target: string): {
	anchor: string | null;
	baseTarget: string;
} {
	const hashIndex = target.indexOf("#");
	if (hashIndex < 0) {
		return {
			anchor: null,
			baseTarget: target,
		};
	}
	return {
		anchor: target.slice(hashIndex),
		baseTarget: target.slice(0, hashIndex),
	};
}

function parseExplicitPath(target: string): {
	pathParts: string[];
	basename: string;
} | null {
	const normalized = target.trim().replace(/\\/g, "/");
	if (normalized.length === 0) {
		return null;
	}

	const pathPartsRaw = normalized
		.replace(/^\/+/, "")
		.split("/")
		.filter((part) => part.length > 0);
	if (pathPartsRaw.length < 2) {
		return null;
	}

	const basenameRaw = pathPartsRaw[pathPartsRaw.length - 1];
	if (!basenameRaw) {
		return null;
	}

	const basename = normalizeBasename(basenameRaw);
	const pathParts = pathPartsRaw.slice(0, -1);
	return { basename, pathParts };
}

function normalizeBasename(target: string): string {
	const trimmed = target.trim();
	const lastSlash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	const basename = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
	return basename.toLowerCase().endsWith(".md")
		? basename.slice(0, -3)
		: basename;
}

function dedupeStrings(values: string[]): string[] {
	const deduped: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const key = value.trim();
		if (key.length === 0 || seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(key);
	}
	return deduped;
}

export function parseSingleLinguisticWikilink(params: {
	wikilink: ParsedWikilink;
	sectionCssKind: string;
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
}): LinguisticWikilinkDto {
	const parsed = parseLinguisticWikilinks({
		content: params.wikilink.fullMatch,
		lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
		parseLibraryBasename: params.parseLibraryBasename,
		sectionCssKind: params.sectionCssKind,
	});
	return (
		parsed[0] ?? {
			alias: params.wikilink.alias,
			anchor: null,
			fullMatch: params.wikilink.fullMatch,
			intent: "GenerateSectionLink",
			sectionCssKind: params.sectionCssKind,
			source: "TextfresserCommand",
			surface: params.wikilink.surface,
			target: params.wikilink.target,
			targetKind: "None",
			targetRef: {
				kind: "Unresolved",
				target: params.wikilink.target,
			},
		}
	);
}
