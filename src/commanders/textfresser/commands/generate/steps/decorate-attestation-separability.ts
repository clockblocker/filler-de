/**
 * Decorate attestation wikilinks in the source reading note with separability markers.
 *
 * For separable verbs with multi-span wikilinks (e.g., [[aufpassen|Pass]] ... [[aufpassen|auf]]),
 * decorates aliases:
 * - Prefix span → `[[aufpassen|auf<]]` (detached prefix)
 * - Stem span  → `[[aufpassen|>Pass]]` (stem/root)
 *
 * Only runs when:
 * - A separable prefix morpheme exists in ctx.morphemes
 * - The source note has >1 wikilinks targeting the lemma with aliases (multi-span)
 *
 * Produces a ProcessMdFile action for the source reading note (attestation.source.path).
 */

import { ok, type Result } from "neverthrow";
import { VaultActionKind } from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";

export function decorateAttestationSeparability(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const separablePrefix = ctx.morphemes.find(
		(m) => m.kind === "Prefix" && m.separability === "Separable",
	);
	if (!separablePrefix) return ok(ctx);

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const lemma = lemmaResult.lemma;
	const prefixSurf = separablePrefix.surf;
	const sourcePath = lemmaResult.attestation.source.path;

	const transform = (content: string): string => {
		const wikilinks = wikilinkHelper.parse(content);
		const targetLinks = wikilinks.filter(
			(w) => w.target === lemma && w.alias !== null,
		);

		// Only decorate if there are multiple spans (multi-span linking)
		if (targetLinks.length <= 1) return content;

		let result = content;
		for (const link of targetLinks) {
			if (!link.alias) continue;

			// Skip if already decorated (idempotency guard)
			if (link.alias.startsWith(">") || link.alias.endsWith("<"))
				continue;

			const isPrefix =
				link.alias.toLowerCase() === prefixSurf.toLowerCase();
			const decorated = isPrefix
				? `[[${lemma}|${link.alias}<]]`
				: `[[${lemma}|>${link.alias}]]`;

			result = result.replace(link.fullMatch, decorated);
		}
		return result;
	};

	return ok({
		...ctx,
		actions: [
			...ctx.actions,
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: { splitPath: sourcePath, transform },
			},
		],
	});
}
