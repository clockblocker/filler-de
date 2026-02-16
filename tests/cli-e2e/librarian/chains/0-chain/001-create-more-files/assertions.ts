import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_001 } from "./vault-expectations";

export async function testPostHealing001(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_001.postHealing);
}
