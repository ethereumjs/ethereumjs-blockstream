import { Block } from "./models/block";
import { Log } from "./models/log";
import { BlockHistory } from "./models/block-history";
import { LogHistory } from "./models/log-history";
import { BlockAndLogHistory } from "./models/block-and-log-history";
import { Filter, FilterOptions } from "./models/filters";
import { reconcileBlockHistory } from "./block-reconciler";
import { reconcileLogHistoryWithAddedBlock, reconcileLogHistoryWithRemovedBlock } from "./log-reconciler";
import { reconcileBlocksAndLogs } from "./block-and-log-reconciler";

export function reconcileBlockHistoryWithCallback(
	getBlockByHash: (hash: string, callback: (error?: Error, block?: Block | null) => void) => void,
	blockHistory: BlockHistory | null,
	newBlock: Block,
	onBlockAdded: (block: Block, callback: (error?: Error) => void) => void,
	onBlockRemoved: (block: Block, callback: (error?: Error) => void) => void,
	blockRetention: number,
	callback: (error?: Error, newHistory?: BlockHistory) => void,
): void {
	const wrappedGetBlockByHash = (hash: string): Promise<Block | null> => new Promise<Block | null>((resolve, reject) => {
		getBlockByHash(hash, (error, block) => {
			if (error) reject(error);
			else resolve(block);
		});
	});
	const wrappedOnBlockAdded = (block: Block): Promise<void> => new Promise<void>((resolve, reject) => {
		onBlockAdded(block, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});
	const wrappedOnBlockRemoved = (block: Block): Promise<void> => new Promise<void>((resolve, reject) => {
		onBlockRemoved(block, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});
	reconcileBlockHistory(wrappedGetBlockByHash, blockHistory, newBlock, wrappedOnBlockAdded, wrappedOnBlockRemoved, blockRetention)
		.then(newBlockHistory => callback(undefined, newBlockHistory))
		.catch(error => callback(error, undefined));
}

export function reconcileLogHistoryWithAddedBlockWithCallback(
	getLogs: (filterOptions: FilterOptions[], callback: (error?: Error, logs?: Log[]) => void) => void,
	logHistory: LogHistory | null,
	newBlock: Block,
	onLogAdded: (log: Log, callback: (error?: Error) => void) => void,
	filters: Filter[],
	blockRetention: number,
	callback: (error?: Error, newHistory?: LogHistory) => void,
): void {
	const wrappedGetLogs = (filterOptions: FilterOptions[]): Promise<Log[]> => new Promise<Log[]>((resolve, reject) => {
		getLogs(filterOptions, (error, logs) => {
			if (error) reject(error);
			else resolve(logs);
		})
	});
	const wrappedOnLogAdded = (log: Log): Promise<void> => new Promise<void>((resolve, reject) => {
		onLogAdded(log, error => {
			if (error) reject(error);
			else resolve();
		});
	});
	reconcileLogHistoryWithAddedBlock(wrappedGetLogs, logHistory, newBlock, wrappedOnLogAdded, filters, blockRetention)
		.then(newLogHistory => callback(undefined, newLogHistory))
		.catch(error => callback(error, undefined));
}

export function reconcileLogHistoryWithRemovedBlockWithCallback(
	logHistory: LogHistory,
	removedBlock: Block,
	onLogRemoved: (log: Log, callback: (error?: Error) => void) => void,
	callback: (error?: Error, logHistory?: LogHistory) => void,
): void {
	const wrappedOnLogRemoved = (log: Log): Promise<void> => new Promise<void>((resolve, reject) => {
		onLogRemoved(log, error => {
			if (error) reject(error);
			else resolve();
		});
	});
	reconcileLogHistoryWithRemovedBlock(logHistory, removedBlock, wrappedOnLogRemoved)
		.then(logHistory => callback(undefined, logHistory))
		.catch(error => callback(error, undefined));
}

export function reconcileBlocksAndLogsWithCallback(
	getBlockByHash: (hash: string, callback: (error?: Error, block?: Block | null) => void) => void,
	getLogs: (filterOptions: FilterOptions[], callback: (error?: Error, logs?: Log[]) => void) => void,
	history: BlockAndLogHistory | null,
	newBlock: Block,
	onLogAdded: (log: Log, callback: (error?: Error) => void) => void,
	onLogRemoved: (log: Log, callback: (error?: Error) => void) => void,
	filters: Filter[],
	blockRetention: number,
	callback: (error?: Error, newHistory?: BlockAndLogHistory) => void,
): void {
	const wrappedGetBlockByHash = (hash: string): Promise<Block | null> => new Promise<Block | null>((resolve, reject) => {
		getBlockByHash(hash, (error, block) => {
			if (error) reject(error);
			else resolve(block);
		});
	});
	const wrappedGetLogs = (filterOptions: FilterOptions[]): Promise<Log[]> => new Promise<Log[]>((resolve, reject) => {
		getLogs(filterOptions, (error, logs) => {
			if (error) reject(error);
			else resolve(logs);
		})
	});
	const wrappedOnLogAdded = (log: Log): Promise<void> => new Promise<void>((resolve, reject) => {
		onLogAdded(log, error => {
			if (error) reject(error);
			else resolve();
		});
	});
	const wrappedOnLogRemoved = (log: Log): Promise<void> => new Promise<void>((resolve, reject) => {
		onLogRemoved(log, error => {
			if (error) reject(error);
			else resolve();
		});
	});
	reconcileBlocksAndLogs(wrappedGetBlockByHash, wrappedGetLogs, history, newBlock, wrappedOnLogAdded, wrappedOnLogRemoved, filters, blockRetention)
		.then(blockAndLogHistory => callback(undefined, blockAndLogHistory))
		.catch(error => callback(error, undefined));
}
