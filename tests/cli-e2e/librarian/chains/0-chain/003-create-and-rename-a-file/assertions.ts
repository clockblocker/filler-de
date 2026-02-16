import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_003 } from "./vault-expectations";

export async function testPostHealing003(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_003.postHealing);
}
