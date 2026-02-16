import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_005 } from "./vault-expectations";

export async function testPostHealing005(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_005.postHealing);
}
