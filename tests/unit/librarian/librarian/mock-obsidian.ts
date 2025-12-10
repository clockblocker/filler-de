// Mock obsidian module for tests
export class TFile {
	path = '';
	basename = '';
	extension = '';
}

export class TFolder {
	path = '';
	children: (TFile | TFolder)[] = [];
}

export type App = {
	vault: {
		on: (event: string, callback: (...args: unknown[]) => void) => void;
	};
};

