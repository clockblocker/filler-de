import { ACTION_CONFIGS } from "../../../../managers/actions-manager/actions/actions-config";
import {
	type UserCommandKind,
	UserCommandSchema,
} from "../../../../managers/actions-manager/types";
import { logger } from "../../../../utils/logger";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";

export const executeButtonAction = ({
	buttonElement,
	services,
}: {
	buttonElement: HTMLButtonElement;
	services: TexfresserObsidianServices;
}) => {
	const actionId = buttonElement.getAttribute("data-action");

	const parsed = UserCommandSchema.safeParse(actionId);

	if (parsed.success) {
		const command = parsed.data as UserCommandKind;
		const cfg = ACTION_CONFIGS[command];
		try {
			cfg.execute(services);
		} catch (err) {
			logger.error("Failed to execute command", command, err);
		}
	} else {
		logger.error("[executeButtonAction] Invalid action ID", actionId);
	}
};
