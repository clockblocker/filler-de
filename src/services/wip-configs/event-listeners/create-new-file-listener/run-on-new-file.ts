import { type App, MarkdownView, TFile } from "obsidian";

export function onNewFileThenRun(
	app: App,
	file: TFile,
	run: (view: MarkdownView) => void,
) {
	let timeout: number | null = null;

	// try immediately if it's already the active view
	const tryRun = () => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file?.path === file.path) {
			run(view);
			return true;
		}
		return false;
	};
	if (tryRun()) return;

	// wait for it to be opened
	const openRef = app.workspace.on("file-open", (opened) => {
		if (!opened || opened.path !== file.path) return;

		// once opened, debounce on 'modify' to wait for templates/other plugins
		const clearTimer = () => {
			if (timeout) {
				window.clearTimeout(timeout);
				timeout = null;
			}
		};

		const done = () => {
			clearTimer();
			// final guard: run against the active view of THIS file
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.file?.path === file.path) run(view);

			app.vault.offref(modRef);
			app.workspace.offref(openRef);
		};

		const TIME_IN_MS_TO_WAIT_BEFORE_MAKING_CHNAGES_TO_AWOID_RACES = 60;

		const arm = () => {
			clearTimer();
			timeout = window.setTimeout(
				done,
				TIME_IN_MS_TO_WAIT_BEFORE_MAKING_CHNAGES_TO_AWOID_RACES,
			);
		};

		// start the timer; any further modify resets it
		arm();

		const modRef = app.vault.on("modify", (f) => {
			if (f instanceof TFile && f.path === file.path) arm();
		});
	});
}
