import { type App, MarkdownView, type TFile } from "obsidian";
import { DomSelectors } from "../../../../../../utils/dom-selectors";

export function waitForViewReady(
	app: App,
	tfile: TFile,
	timeoutMs = 500,
): Promise<void> {
	return new Promise((resolve) => {
		const checkView = () => {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			const hasContainer = view?.contentEl.querySelector(
				DomSelectors.CM_CONTENT_CONTAINER,
			);
			const pathMatch = view?.file?.path === tfile.path;
			return pathMatch && hasContainer;
		};

		if (checkView()) {
			resolve();
			return;
		}

		const observer = new MutationObserver(() => {
			if (checkView()) {
				observer.disconnect();
				resolve();
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		setTimeout(() => {
			observer.disconnect();
			resolve();
		}, timeoutMs);
	});
}
