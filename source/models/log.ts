export interface Log {
	readonly logIndex: string,
	readonly blockNumber: string,
	readonly blockHash: string,
	readonly transactionHash: string,
	readonly transactionIndex: string,
	readonly address: string,
	readonly data: string, 
	readonly topics: string[],
}
