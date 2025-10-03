import { App, MarkdownView, TFile } from 'obsidian';
import { UserAction } from '../../actions/types';
import { BOTTOM_CONDITIONAL_ACTIONS } from '../../actions/interface';
import { TextsManagerService } from './texts-manager-service';

export class ConditionalActionsService {
	constructor(
		private app: App,
		private textsManagerService: TextsManagerService
	) {}

	/**
	 * Gets the actions that should be shown based on the current file state
	 */
	async getVisibleActions(): Promise<{ action: UserAction; label: string }[]> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !activeView.file) {
			return [];
		}

		const visibleActions: { action: UserAction; label: string }[] = [];

		for (const action of BOTTOM_CONDITIONAL_ACTIONS) {
			const shouldShow = await this.shouldShowAction(
				action.action,
				activeView.file
			);
			if (shouldShow) {
				visibleActions.push(action);
			}
		}

		return visibleActions;
	}

	/**
	 * Determines if an action should be shown based on the current file
	 */
	private async shouldShowAction(
		action: UserAction,
		file: TFile
	): Promise<boolean> {
		switch (action) {
			case UserAction.MakeText:
				// Show if file has empty metaInfo
				return await this.textsManagerService.hasEmptyMetaInfo(file);

			case UserAction.NavigatePages:
			case UserAction.PreviousPage:
				// Show if file has metaInfo indicating it's a page
				return await this.textsManagerService.

			default:
				return false;
		}
	}
}
