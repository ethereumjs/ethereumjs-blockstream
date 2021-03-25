// @file Block
// @exports Block
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Transaction } from "./transaction";

export interface Block {
	readonly number: number;
	readonly hash: string;
	readonly parentHash: string;
	readonly difficulty: number;
	readonly gasLimit: BigNumber;
}
