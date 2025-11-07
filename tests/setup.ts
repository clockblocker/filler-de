// Mock obsidian module for tests
// This file is loaded before tests run

// @ts-expect-error - Mocking obsidian module for tests
if (typeof globalThis.require !== 'undefined') {
	// @ts-expect-error - Mocking obsidian module for tests
	globalThis.require.cache = globalThis.require.cache || {};
	// @ts-expect-error - Mocking obsidian module for tests
	globalThis.require.cache['obsidian'] = {
		exports: {
			TFile: class TFile {
				path = '';
				basename = '';
				extension = '';
			},
			TFolder: class TFolder {
				path = '';
				children: (unknown)[] = [];
			},
		},
	};
}

