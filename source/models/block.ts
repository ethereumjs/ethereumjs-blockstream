import { Transaction } from "./transaction";

export interface Block {
	readonly number: string;
	readonly hash: string;
	readonly parentHash: string;
	readonly nonce: string;
	readonly sha3Uncles: string;
	readonly logsBloom: string;
	readonly transactionRoot: string;
	readonly stateRoot: string;
	readonly receiptsRoot: string;
	readonly miner: string;
	readonly difficulty: string;
	readonly totalDifficulty: string;
	readonly size: string;
	readonly gasLimit: string;
	readonly gasUsed: string;
	readonly timestamp: string;
	readonly transactions: string[] | Transaction[];
	readonly uncles: string[];
}
