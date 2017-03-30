import { BlockHistory } from "./block-history";
import { LogHistory } from "./log-history";

export interface BlockAndLogHistory {
	readonly blockHistory: BlockHistory,
	readonly logHistory: LogHistory,
}
