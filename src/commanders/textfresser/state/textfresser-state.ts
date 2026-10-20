import type { Dumgen } from "dumgen";
import type { LanguagesConfig } from "../../../types";

export type TextfresserState = {
	/**
	 * The plugin's one dumgen instance, read on each use so a key change
	 * takes effect. It throws once the plugin has unloaded.
	 */
	getDumgen: () => Dumgen;
	languages: LanguagesConfig;
};
