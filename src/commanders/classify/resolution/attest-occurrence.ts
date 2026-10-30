/**
 * A click on a unit's link in a Scroll attests that occurrence (#281):
 * Classify linked it, and only the click makes it an Attestation, an
 * `![[Scroll#^N|^occ]]` embed in its Reading note with its Attestation
 * Link.
 *
 * The click's offset names its link; the link's Sentence, from the
 * Segmentation Cache, names its occurrence key (`occurrencesAt`). An
 * occurrence the dictionary already holds a ref of, naming the block the
 * link stands in, is left alone, so a second click adds nothing. Any
 * other is resolved again by Classify on the link alone, as `Clicked`: from the judgement Classify cached when it
 * linked it, judging again only on a miss, it cuts and mints the clicked
 * Sentence's block in one compare-and-swap write and commits the ref. A
 * Sentence edited since it was linked has no cached segmentation and is
 * segmented again.
 *
 * Every click runs in the background, after Obsidian was told to open the
 * link, so it never holds up the navigation. Clicks on one occurrence while
 * one attests it wait for that one, and so do nothing more; the Scroll is
 * marked busy throughout (`ScrollActivity`), so the unlink observer leaves
 * it alone. Closing the scope, as the plugin unloads, interrupts them.
 */
import type { DumdictVaultStore } from "@textfresser/dictionary";
import { WORTER_FOLDER } from "@textfresser/lemma-note-codec";
import { VaultPath } from "@textfresser/vault-action-manager";
import {
	Cause,
	Deferred,
	Effect,
	FiberSet,
	Predicate,
	type Scope,
} from "effect";
import { interruptsOf } from "../../../utils/causes";
import { IdleTracker } from "../../../utils/idle-tracker";
import type {
	ClassifyError,
	ClassifyInput,
	ClassifyOutcome,
} from "../classify-selection";
import type { SegmentationCache } from "../segmentation-cache";
import { tellUser } from "./notify";
import { occurrencesAt } from "./occurrence-keys";
import type { ScrollActivity } from "./scroll-activity";
import { parseAttestationRef } from "./scroll-links";
import { linkpathOf, scrollLinksOf } from "./scroll-unlinks";
import { refsInto, type UnlinkScrolls } from "./unlink-observer";

export type OccurrenceAttesterDeps<E = unknown> = {
	readonly store: Effect.Effect<
		Pick<DumdictVaultStore, "attestationLinksWithRefPrefix">,
		E
	>;
	readonly scrolls: Pick<UnlinkScrolls, "read" | "resolve">;
	readonly cache: Pick<SegmentationCache["Service"], "get">;
	readonly segmenterVersion: Effect.Effect<string>;
	readonly activity: ScrollActivity;
	/** Classify on the plugin's dumgen, as the command runs it. */
	readonly classify: (
		input: ClassifyInput,
	) => Effect.Effect<ClassifyOutcome, ClassifyError>;
	/** Why nothing may be attested in the Scroll now, such as a dictionary reset. */
	readonly blockedBy?: (scrollPath: string) => string | undefined;
	/** Shows the user a notice; until #229, Obsidian's `Notice`. */
	readonly notify?: (message: string) => void;
};

/** A click on a link, as the event layer tells it. */
type LinkClicked = {
	/** The note the link stands in. */
	readonly sourcePath: string;
	/** Where it stands in that note's text, inside its `[[…]]`. */
	readonly offset?: number;
	/** Its target, as written, which the link at `offset` must have. */
	readonly target: string;
};

export type OccurrenceAttester = {
	/**
	 * Attests the clicked link's occurrence, in the background: it ends at
	 * once, before anything is read.
	 */
	readonly clicked: (click: LinkClicked) => Effect.Effect<void>;
	/** Ends once no click is being attested. */
	readonly whenIdle: Effect.Effect<void>;
};

const inWorter = (path: string) =>
	VaultPath.caseInsensitive.isUnder(path, WORTER_FOLDER, {
		inclusive: false,
	});

/** The attester, in the current scope. */
export const makeOccurrenceAttester = Effect.fnUntraced(function* <E>(
	deps: OccurrenceAttesterDeps<E>,
): Effect.fn.Return<OccurrenceAttester, never, Scope.Scope> {
	const idle = yield* IdleTracker;
	const runs = yield* FiberSet.make<void>();
	const tell = tellUser(deps.notify);
	/** The occurrences being attested, by Scroll and occurrence, with when each is done. */
	const attesting = new Map<string, Deferred.Deferred<void>>();

	/** Runs `attest` once for `key` at a time; a click meanwhile waits for it. */
	const once = <Err>(key: string, attest: Effect.Effect<void, Err>) =>
		Effect.suspend(() => {
			const running = attesting.get(key);
			if (running) return Deferred.await(running);
			const done = Deferred.makeUnsafe<void>();
			attesting.set(key, done);
			return attest.pipe(
				Effect.ensuring(
					Effect.suspend(() => {
						attesting.delete(key);
						return Deferred.succeed(done, undefined);
					}),
				),
			);
		});

	const attest = (scrollPath: string, offset: number, target: string) =>
		Effect.gen(function* () {
			if (inWorter(scrollPath)) return;
			const blocked = deps.blockedBy?.(scrollPath);
			if (blocked !== undefined) {
				yield* Effect.logInfo(
					`[Classify] Not attesting a click in ${scrollPath}: ${blocked}`,
				);
				return;
			}
			const content = yield* deps.scrolls.read(scrollPath);
			if (content === undefined) return;
			const link = scrollLinksOf(content).find(
				({ whole }) => whole.from <= offset && offset <= whole.to,
			);
			// The text read may lag the editor, or be another note's: only a
			// link with the clicked target is the clicked one.
			if (
				!link ||
				link.linkpath === "" ||
				link.linkpath !== linkpathOf(target)
			) {
				yield* Effect.logInfo(
					`[Classify] Not attesting a click in ${scrollPath}: no link to ${target} stands at ${offset}`,
				);
				return;
			}
			const note = yield* deps.scrolls.resolve(link.linkpath, scrollPath);
			if (note === undefined || !inWorter(note)) return;
			const keyed = (yield* occurrencesAt(
				content,
				[link.shown],
				deps.cache,
				yield* deps.segmenterVersion,
			)).get(link.shown.from);
			yield* once(
				`${scrollPath}\u0000${keyed?.occurrence ?? `@${link.shown.from}`}`,
				Effect.gen(function* () {
					// Attested already: a stored ref of this occurrence names the
					// block the link stands in. One whose block went, as a
					// deleted refrain copy's, leaves the copy that took over its
					// key unattested; the unlink observer removes it.
					if (keyed && link.block !== undefined) {
						const store = yield* deps.store;
						const stored = yield* refsInto(store, scrollPath);
						if (
							stored.some(({ ref }) => {
								const parsed = parseAttestationRef(ref);
								return (
									parsed?.occurrence === keyed.occurrence &&
									parsed.blockId === link.block
								);
							})
						)
							return;
					}
					const outcome = yield* deps.classify({
						attest: "Clicked",
						clickedReading: note,
						content,
						german: "Known",
						scrollPath,
						selection: link.shown,
					});
					const pending = outcome.resolutions.flatMap((resolution) =>
						resolution._tag === "Pending"
							? [resolution.reason]
							: [],
					);
					if (pending.length > 0)
						yield* tell(
							`⚠ Could not attest ${content.slice(link.shown.from, link.shown.to)}: ${pending.join("; ")}`,
						);
				}).pipe(
					Effect.catchIf(
						(error): error is ClassifyError =>
							Predicate.isTagged(error, "ClassifyError"),
						(error) =>
							tell(
								`⚠ Could not attest ${content.slice(link.shown.from, link.shown.to)}: ${error.message}`,
							),
					),
				),
			);
		}).pipe(
			(effect) => deps.activity.during(scrollPath, effect),
			Effect.catchCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(interruptsOf(cause))
					: Effect.logWarning(
							"[Classify] Attesting a clicked occurrence failed:",
							cause,
						),
			),
			Effect.withSpan("classify.attestOccurrence", {
				attributes: { offset, scrollPath },
			}),
		);

	return {
		clicked: ({ offset, sourcePath, target }) =>
			offset === undefined
				? Effect.void
				: FiberSet.run(
						runs,
						idle.track(attest(sourcePath, offset, target)),
						{
							startImmediately: true,
						},
					).pipe(Effect.asVoid),
		whenIdle: FiberSet.awaitEmpty(runs),
	};
});
