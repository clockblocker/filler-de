import { ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { logger } from "../../../../../utils/logger";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import type { CommandError, CommandStateWithLemma } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import {
	orderGenerateEntrySections,
	serializeGenerateEntries,
} from "./canonical-note-entry";

/** Serialize all DictEntries into file content, apply noteKind metadata, and update activeFile. */
export function serializeEntry(
	ctx: GenerateSectionsResult,
): Result<CommandStateWithLemma, CommandError> {
	for (const entry of ctx.allEntries) {
		orderGenerateEntrySections(entry);
	}

	const { body, meta } = serializeGenerateEntries(ctx.allEntries);

	const fullMeta = { ...meta, noteKind: DICT_ENTRY_NOTE_KIND };
	logger.info(
		`[serialize] meta keys: ${JSON.stringify(Object.keys(fullMeta))}`,
	);

	const transform = noteMetadataHelper.upsert(fullMeta);
	const content = transform(body) as string;

	return ok({
		...ctx,
		commandContext: {
			...ctx.commandContext,
			activeFile: {
				...ctx.commandContext.activeFile,
				content,
			},
		},
	});
}
