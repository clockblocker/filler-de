import type { ParsingIssue } from "common-utils/validation";
import type { PartScope, TypedBlockKind } from "./blocks";

/** Where in a document an issue sits. `partIndex` indexes `document.parts`. */
export type IssueLocation =
	| { readonly scope: "preamble" }
	| { readonly scope: "note" }
	| { readonly scope: PartScope; readonly partIndex: number };

export type RecordName =
	| "LemmaRecord"
	| "ReadingEntry"
	| "SurfaceEntry"
	| "PendingSemanticRelationRecord";

/**
 * Why a Lemma note's Blocks do not make valid dumdict records. Issues are
 * values: parsing a hand-edited note never throws.
 */
export type CodecIssue =
	| {
			/** A note lacks its `identity`, or a part its `reading` or `surface` Block. */
			readonly _tag: "MissingRequiredBlock";
			readonly kind: "identity" | "reading" | "surface";
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A Block that occurs at most once per part occurs again. */
			readonly _tag: "DuplicateBlock";
			readonly kind: TypedBlockKind;
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A second Lemma part. */
			readonly _tag: "DuplicatePart";
			readonly scope: "lemma";
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A typed Block outside the scope that owns it, or before the first part. */
			readonly _tag: "MisplacedBlock";
			readonly kind: TypedBlockKind;
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A serialized Block whose payload is not JSON, or not the JSON shape it holds. */
			readonly _tag: "InvalidBlockPayload";
			readonly kind: TypedBlockKind;
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A reconstructed record its dumdict `parseAs*` parser rejects. */
			readonly _tag: "InvalidRecord";
			readonly record: RecordName;
			readonly at: IssueLocation;
			readonly issues: readonly ParsingIssue[];
			readonly message: string;
	  }
	| {
			/** Valid records that contradict each other or the note (spec invariants 3 to 7). */
			readonly _tag: "InconsistentRecord";
			readonly at: IssueLocation;
			readonly message: string;
	  }
	| {
			/** A part whose Block ID is not the one its identity gives. */
			readonly _tag: "BlockIdMismatch";
			readonly at: IssueLocation;
			readonly expected: string;
			readonly found: string | undefined;
			readonly message: string;
	  };

export type CodecIssueTag = CodecIssue["_tag"];
