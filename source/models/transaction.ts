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
