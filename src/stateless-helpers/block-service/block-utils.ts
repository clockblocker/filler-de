/**
 * Shared utilities for block marker operations.
 * Re-exports from pure-formatting-utils for backwards compatibility.
 */

import { blockIdHelper } from "../pure-formatting-utils";

export const getBlockIdFromLine = blockIdHelper.extractNumeric;
export const findHighestBlockNumber = blockIdHelper.findHighestNumber;
export const formatBlockEmbed = blockIdHelper.formatEmbed;
