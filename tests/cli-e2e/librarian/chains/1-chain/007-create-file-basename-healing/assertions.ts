import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_007 } from "./vault-expectations";

export async function testPostHealing007(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_007.postHealing);
}
