import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_004 } from "./vault-expectations";

export async function testPostHealing004(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_004.postHealing);
}
