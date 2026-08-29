export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type PrettifyDeep<T> = T extends
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined
	| Function
	? T
	: T extends readonly unknown[]
		? {
				[K in keyof T]: PrettifyDeep<T[K]>;
			}
		: T extends object
			? {
					[K in keyof T]: PrettifyDeep<T[K]>;
				} & {}
			: T;








export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Inverts a record type, swapping keys and values.
 * Used to derive reverse mapping from TreeNodeKind → SplitPathKind.
 */
export type InvertRecord<R extends Record<PropertyKey, PropertyKey>> = {
	[K in keyof R as R[K]]: K;
};
