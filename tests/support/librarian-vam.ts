/**
 * A fake VAM's `scanAndSubscribe`, built from a fake scan and a fake bulk
 * channel, for Librarian tests that drive the vault by hand.
 */
import type {
	BulkVaultEvent,
	VamScanError,
	VaultCursor,
	VaultScanPathWithStat,
	VaultScanResult,
	VaultSnapshot,
	VaultSnapshotSubscription,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { LibrarianVam } from "../../src/commanders/librarian/librarian";

type BulkHandler = (bulk: BulkVaultEvent) => Effect.Effect<void, unknown>;

/** What these fakes give in place of `scanAndSubscribe`. */
export type ScanAndBulkFake = {
	readonly scan: () => Effect.Effect<VaultScanResult, VamScanError>;
	readonly subscribeToBulk: (
		handler: BulkHandler,
	) => Effect.Effect<{ readonly close: Effect.Effect<void> }>;
};

const NO_STAT = { ctime: 0, mtime: 0, size: 0 };

function snapshotOf(scan: VaultScanResult): VaultSnapshot {
	const entries = scan.entries.map(
		(entry): VaultScanPathWithStat => ({ ...entry, stat: NO_STAT }),
	);
	return { ...scan, cursor: 0 as VaultCursor, entries } as VaultSnapshot;
}

/**
 * `fake` as a `LibrarianVam`. Like VAM, its subscription holds the bulks
 * emitted before `start` and delivers them then; unlike VAM, it numbers
 * nothing, so a rescan drops nothing and `afterSnapshot` keeps every bulk.
 * A failed scan subscribes nothing.
 */
export function withScanAndSubscribe(
	fake: Omit<LibrarianVam, "scanAndSubscribe"> & ScanAndBulkFake,
): LibrarianVam {
	const { scan, subscribeToBulk, ...vam } = fake;
	return {
		...vam,
		scanAndSubscribe: (_folder, handlers) =>
			Effect.gen(function* () {
				const snapshot = snapshotOf(yield* scan());
				const onBulk: BulkHandler = handlers.onBulk ?? (() => Effect.void);
				const held: BulkVaultEvent[] = [];
				let started = false;
				const subscription = yield* subscribeToBulk((bulk) =>
					started ? onBulk(bulk) : Effect.sync(() => void held.push(bulk)),
				);
				const start = Effect.suspend(() => {
					started = true;
					return Effect.forEach(held.splice(0), onBulk, {
						discard: true,
					}).pipe(Effect.ignore);
				});
				return {
					afterSnapshot: (bulk) => bulk,
					caughtUp: Effect.void,
					close: subscription.close,
					rescan: Effect.suspend(scan).pipe(Effect.map(snapshotOf)),
					snapshot,
					start,
				} satisfies VaultSnapshotSubscription;
			}),
	};
}
