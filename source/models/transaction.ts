import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { BytesLike, SignatureLike } from "@ethersproject/bytes";
import { Transaction } from "@ethersproject/transactions";

/**
export interface Transaction {
	readonly hash: string;
	readonly nonce: string;
	readonly blockHash: string;
	readonly blockNumber: string;
	readonly transactionIndex: string;
	readonly from: string;
	readonly to: string;
	readonly value: string;
	readonly gasPrice: string;
	readonly gas: string;
	readonly input: string;
}
*/

export interface Transaction {
    readonly hash?: string;
    readonly nonce: number;
    readonly blockNumber?: number;
    readonly blockHash?: string;
    readonly transactionIndex: number;
    readonly to?: string;
    readonly from?: string;
    readonly gasLimit: BigNumber;
    readonly gasPrice: BigNumber;
    readonly data: string;
    readonly value: BigNumber;
    readonly chainId: number;
}
