import { z } from "zod/v3";

import { Case } from "../ud/case";

export const GovernedCase = Case;
export type GovernedCase = z.infer<typeof GovernedCase>;

export function getReprForGovernedCase(_governedCase: GovernedCase) {
	const reprForGovernedCase = "governed case";

	return reprForGovernedCase;
}
