// @file Log
// @exports LogInterface
export interface Log {
    readonly blockNumber: number;
    readonly blockHash: string;
    readonly transactionIndex: number;
    readonly logIndex: string;
	readonly topics: string[],
}
