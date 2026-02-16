import { expectExactCodexes, expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_002 } from "./vault-expectations";

export async function testPostHealing002(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_002.postHealing);
	// Check for orphan codexes (old codexes that should have been deleted)
	await expectExactCodexes(VAULT_EXPECTATIONS_002.postHealing.codexes);
}
