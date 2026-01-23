import { FileType } from "../../../types/common-interface/enums";
import {
	ACTION_CONFIGS,
	CHANGE_FILE_TYPE_ACTIONS,
	getAllAboveSelectionActions,
	getAllBottomActions,
	NAVIGATE_PAGE_ACTIONS,
	OPTIONAL_BOTTOM_ACTIONS,
} from "./actions-config";
import type { AnyActionConfig } from "./types";

export const getBottomActionConfigs = ({
	fileType,
	fileName,
	pathParts,
}: {
	fileType: FileType | null;
	fileName: string;
	pathParts: string[];
}): AnyActionConfig[] => {
	const actions = getAllBottomActions().filter((action) =>
		OPTIONAL_BOTTOM_ACTIONS.includes(action),
	);

	if (!fileType) {
		CHANGE_FILE_TYPE_ACTIONS.forEach((action) => actions.push(action));
	}

	if (fileType === FileType.Page) {
		NAVIGATE_PAGE_ACTIONS.forEach((action) => actions.push(action));
	}

	return actions.map((action) => ACTION_CONFIGS[action]);
};

export const getAboveSelectionActionConfigs = ({
	fileType,
	fileName,
	pathParts,
	sectionText,
}: {
	fileType: FileType | null;
	fileName: string;
	pathParts: string[];
	sectionText: string;
}): AnyActionConfig[] => {
	const actions = getAllAboveSelectionActions();

	return actions.map((action) => ACTION_CONFIGS[action]);
};
