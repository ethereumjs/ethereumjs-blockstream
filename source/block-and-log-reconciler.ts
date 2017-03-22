import { Block } from "./models/block";
import { Log } from "./models/log";
import { BlockHistory } from "./models/block-history";
import { LogHistory } from "./models/log-history";
import { BlockAndLogHistory } from "./models/block-and-log-history";
import { Filter, FilterOptions } from "./models/filters";
import { reconcileBlockHistory } from "./block-reconciler";
import { reconcileLogHistoryWithAddedBlock, reconcileLogHistoryWithRemovedBlock } from "./log-reconciler";
import { List as ImmutableList } from "immutable";

export async function reconcileBlocksAndLogs(
	getBlockByHash: (hash: string) => Promise<Block | null>,
	getLogs: (filterOptions: FilterOptions[]) => Promise<Log[]>,
	history: BlockAndLogHistory | null,
	newBlock: Block,
	onLogAdded: (log: Log) => Promise<void>,
	onLogRemoved: (log: Log) => Promise<void>,
	filters: Filter[] = [],
	blockRetention: number = 100,
): Promise<BlockAndLogHistory> {
	const blockHistory = (history) ? history.blockHistory : ImmutableList<Block>();
	let newLogHistory = (history) ? history.logHistory : ImmutableList<Log>();
	const onBlockAdded = async (block: Block) => { newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, newLogHistory, block, onLogAdded, filters, blockRetention); };
	const onBlockRemoved = async (block: Block) => { newLogHistory = await reconcileLogHistoryWithRemovedBlock(newLogHistory, block, onLogRemoved); };
	const newBlockHistory = await reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention);
	return { blockHistory: newBlockHistory, logHistory: newLogHistory };
}
