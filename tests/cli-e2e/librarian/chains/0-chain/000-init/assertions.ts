import { expectFilesToExist } from "../../../../utils";
import { VAULT_EXPECTATIONS_000 } from "./vault-expectations";

export async function testAllCodexesCreatedOnInit(): Promise<void> {
	await expectFilesToExist(VAULT_EXPECTATIONS_000.postHealing.codexes);
}

export async function testAllFilesSuffixedOnInit(): Promise<void> {
	await expectFilesToExist(VAULT_EXPECTATIONS_000.postHealing.files);
}
