import { Transaction } from "./transaction";

export interface Block {
	readonly number: string;
	readonly hash: string;
	readonly parentHash: string;
}
