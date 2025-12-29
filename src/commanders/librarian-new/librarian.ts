import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import { logger } from "../../utils/logger";

export class Librarian {
	private eventTeardown: (() => void) | null = null;

	constructor(
		private readonly vaultActionManager: ObsidianVaultActionManager,
	) {}

	/**
	 * Initialize librarian: read tree and heal mismatches.
	 * Mode 2: Path is king, suffix-only renames.
	 */
	async init(): Promise<void> {
		// const {
		// 	splitPathToLibraryRoot: { basename: libraryRoot },
		// } = getParsedUserSettings();

		this.subscribeToVaultEvents();
	}

	/**
	 * Note: testTRefStaleness removed - tRefs are no longer stored in tree nodes.
	 * TFile references become stale when files are renamed/moved, so they're resolved on-demand.
	 */

	/**
	 * Subscribe to file system events from VaultActionManager.
	 * Converts VaultEvent to librarian handler calls.
	 */
	private subscribeToVaultEvents(): void {
		this.eventTeardown = this.vaultActionManager.subscribeToBulk(
			async (bulk) => {
				logger.info("bulk", bulk.debug);
			},
		);
	}

	/**
	 * Cleanup: unsubscribe from vault events.
	 */
	unsubscribeFromVaultEvents(): void {
		if (this.eventTeardown) {
			this.eventTeardown();
			this.eventTeardown = null;
		}
	}
}
