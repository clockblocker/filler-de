import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_008 } from "./vault-expectations";

export async function testPostHealing008(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_008.postHealing);
}
