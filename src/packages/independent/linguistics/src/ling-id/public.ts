// import Result from "neverthrow";

// export type LingId<
// 	LIK extends LingEntity = LingEntity,
// 	L extends TargetLanguage = TargetLanguage,
// > =  //...

// function makeLingIdForSelection<L extends TargetLanguage = TargetLanguage>(selection: Selection<L>): LingId<'Selection', L> {

// }

// function tryToDecodeSelectionFromLingId<L extends TargetLanguage = TargetLanguage>(LingId<'Selection', L>): Result<Selection<L>> {

// }

// ...

// export const LingIdCodec = {
// English: {
// 	makeLingIdFor: // all makeLingIdFor... overloaded
// 	tryToDecode: // all tryToDecode... overloaded
// }
// } satisfies {
// 		L in TargetLanguage: {
// 			makeLingIdFor: ...
// 			tryToDecode: ...
// 		}
// }
