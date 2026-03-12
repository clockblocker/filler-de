import { mock } from "bun:test";

// ESM-friendly mock for "obsidian" so imports resolve in tests
mock.module("obsidian", () => ({
	MarkdownView: class MarkdownView {
		file: unknown;
		editor: unknown;
	},
	Notice: class Notice {
		constructor(_message: string) {}
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
