// @file Log
// @exports LogInterface
export interface Log {
	readonly blockNumber: string;
	readonly blockHash: string;
	readonly transactionIndex: number;
	readonly logIndex: string;
	readonly topics: string[];
}
