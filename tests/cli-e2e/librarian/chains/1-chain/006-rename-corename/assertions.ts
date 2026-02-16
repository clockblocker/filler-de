import { expectPostHealing } from "../../../../utils";
import { VAULT_EXPECTATIONS_006 } from "./vault-expectations";

export async function testPostHealing006(): Promise<void> {
	await expectPostHealing(VAULT_EXPECTATIONS_006.postHealing);
}
