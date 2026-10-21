import { mock } from "bun:test";
import { parse, stringify } from "yaml";

/**
 * Obsidian's `parseYaml` and `stringifyYaml` are the `yaml` package's
 * `parse` and `stringify`, called with these options (Obsidian 1.14.4).
 */
const parseYaml = (text: string): unknown => parse(text, {});
const stringifyYaml = (value: unknown): string =>
	stringify(value, null, {
		aliasDuplicateObjects: false,
		lineWidth: 0,
		nullStr: "",
	});

// ESM-friendly mock for "obsidian" so imports resolve in tests
mock.module("obsidian", () => ({
	MarkdownView: class MarkdownView {
		file: unknown;
		editor: unknown;
	},
	Notice: class Notice {
		constructor(_message: string) {}
	},
	parseYaml,
	stringifyYaml,
	TFile: class TFile {
		path = "";
		basename = "";
		extension = "";
	},
	TFolder: class TFolder {
		path = "";
		children: unknown[] = [];
	},
}));

// CJS fallback (kept for any require-using code paths)
if (typeof require !== "undefined") {
	require.cache = require.cache || {};
	// @ts-expect-error - lightweight module stub for tests, not a full Node Module
	require.cache["obsidian"] = {
		exports: {
			MarkdownView: class MarkdownView {
				file: unknown;
				editor: unknown;
			},
			Notice: class Notice {
				constructor(_message: string) {}
			},
			parseYaml,
			stringifyYaml,
			TFile: class TFile {
				path = "";
				basename = "";
				extension = "";
			},
			TFolder: class TFolder {
				path = "";
				children: unknown[] = [];
			},
		},
	};
}
