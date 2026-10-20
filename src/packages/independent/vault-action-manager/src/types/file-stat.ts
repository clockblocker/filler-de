import { Schema } from "effect";

/**
 * Obsidian's cached file stat: epoch milliseconds and bytes.
 *
 * A startup index can key cached entries by `(path, mtime)` and skip reading
 * files whose modification time did not change.
 */
const VaultFileStatSchema = Schema.Struct({
	ctime: Schema.Number,
	mtime: Schema.Number,
	size: Schema.Number,
});

export type VaultFileStat = typeof VaultFileStatSchema.Type;

/** Decodes and copies a live `TFile.stat`, which Obsidian mutates in place. */
export const decodeFileStat = Schema.decodeUnknownEffect(VaultFileStatSchema);

export const decodeFileStatOption =
	Schema.decodeUnknownOption(VaultFileStatSchema);
