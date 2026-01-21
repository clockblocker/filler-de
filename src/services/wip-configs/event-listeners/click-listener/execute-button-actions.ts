import { logger } from "../../../../utils/logger";
import type { TexfresserObsidianServices } from "../../../obsidian-services/interface";
import { ACTION_CONFIGS } from "../../actions/actions-config";
import { type UserAction, UserActionSchema } from "../../actions/types";

export const executeButtonAction = ({
	buttonElement,
	services,
}: {
	buttonElement: HTMLButtonElement;
	services: TexfresserObsidianServices;
}) => {
	const actionId = buttonElement.getAttribute("data-action");

	const parsed = UserActionSchema.safeParse(actionId);

	if (parsed.success) {
		const action = parsed.data as UserAction;
		const cfg = ACTION_CONFIGS[action];
		try {
			cfg.execute(services);
		} catch (err) {
			logger.error("Failed to execute action", action, err);
		}
	} else {
		logger.error("[executeButtonAction] Invalid action ID", actionId);
	}
};
