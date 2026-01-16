import { VAULT_EXPECTATIONS_001 } from "../001-create-more-files/vault-expectations";

export const VAULT_EXPECTATIONS_002 = {
    initial: VAULT_EXPECTATIONS_001.postHealing,
    // postHealing expectations TBD after inspecting actual vault state
    postHealing: {
        codexes: [] as string[],
        files: [] as string[],
    },
}
