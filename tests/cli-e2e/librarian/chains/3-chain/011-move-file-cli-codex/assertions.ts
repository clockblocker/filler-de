import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_011 } from "./vault-expectations";

export async function testPostHealing011(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_011.postHealing);
}
