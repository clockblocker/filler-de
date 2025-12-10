import { mock } from "bun:test";

// ESM-friendly mock for "obsidian" so imports resolve in tests
mock.module("obsidian", () => ({
	MarkdownView: class MarkdownView {
		file: unknown;
		editor: unknown;
	},
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
// @ts-expect-error - require only exists in CJS
if (typeof require !== "undefined") {
	// @ts-expect-error - require.cache shape
	require.cache = require.cache || {};
	// @ts-expect-error - require.cache shape
	require.cache["obsidian"] = {
		exports: {
			MarkdownView: class MarkdownView {
				file: unknown;
				editor: unknown;
			},
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
