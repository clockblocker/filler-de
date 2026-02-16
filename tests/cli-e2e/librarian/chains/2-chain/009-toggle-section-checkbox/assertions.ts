import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_009 } from "./vault-expectations";

export async function testPostHealing009(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_009.postHealing);
}
