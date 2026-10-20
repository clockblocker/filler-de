/**
 * A Bun macro: `import { segmenterSourceHash } from "./segmenter-source-hash"
 * with { type: "macro" }` runs it when the plugin is bundled (or a test is
 * transpiled) and inlines its result, so nothing here reaches the bundle.
 *
 * It hashes the battery sources segmentation runs on: dumgen's, and the
 * dumcorpus inventories and dumling routes it reads. The batteries are
 * bundled from source at texteater's `origin/main`, where segmentation can
 * change without a version bump, so the hash goes into every Sentence key:
 * any change to those sources misses the old cache entries.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const BATTERIES = ["dumgen", "dumcorpus", "dumling"] as const;

function filesUnder(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true })
		.flatMap((entry) => {
			const file = path.join(folder, entry.name);
			return entry.isDirectory() ? filesUnder(file) : [file];
		})
		.sort();
}

export function segmenterSourceHash(): string {
	const battery = realpathSync(
		path.join(import.meta.dir, "../../../.texteater/battery"),
	);
	const hash = createHash("sha256");
	for (const name of BATTERIES) {
		const source = path.join(battery, name, "src");
		for (const file of filesUnder(source)) {
			hash.update(path.relative(battery, file));
			hash.update("\0");
			hash.update(readFileSync(file));
			hash.update("\0");
		}
	}
	return hash.digest("hex").slice(0, 12);
}
