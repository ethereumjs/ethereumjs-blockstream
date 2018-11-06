import { Block } from "./models/block";
import { Log } from "./models/log";
import { Filter, FilterOptions } from "./models/filters";
import { LogHistory } from "./models/log-history";
import { parseHexInt } from "./utilities";

export const reconcileLogHistoryWithAddedBlock = async <TBlock extends Block, TLog extends Log>(
	getLogs: (filterOptions: FilterOptions) => Promise<TLog[]>,
	logHistory: LogHistory<TLog> | Promise<LogHistory<TLog>>,
	newBlock: TBlock,
	onLogsAdded: (blockHash: string, logs: Array<TLog>) => Promise<void>,
	filters: Filter[] = [],
	historyBlockLength: number = 100,
): Promise<LogHistory<TLog>> => {
	logHistory = await logHistory;
	const logs = await getFilteredLogs(getLogs, newBlock, filters);
	logHistory = await addNewLogsToHead(newBlock.hash, logHistory, logs, onLogsAdded);
	logHistory = await pruneOldLogs(logHistory, newBlock, historyBlockLength);
	return logHistory;
}

const getFilteredLogs = async <TBlock extends Block, TLog extends Log>(getLogs: (filterOptions: FilterOptions) => Promise<Array<TLog>>, newBlock: TBlock, filters: Array<Filter>): Promise<Array<TLog>> => {
	const logPromises = filters
		.map(filter => ({ blockHash: newBlock.hash, address: filter.address, topics: filter.topics, }))
		.map(filter => getLogs(filter));
	const nestedLogs = await Promise.all(logPromises);
	return nestedLogs.reduce((allLogs, logs) => allLogs.concat(logs), []);
}

const addNewLogsToHead = async <TLog extends Log>(blockHash: string, logHistory: LogHistory<TLog>, newLogs: Array<TLog>, onLogsAdded: (blockHash: string, logs: Array<TLog>) => Promise<void>): Promise<LogHistory<TLog>> => {
	const sortedLogs = newLogs.sort((logA, logB) => parseHexInt(logA.logIndex) - parseHexInt(logB.logIndex));
	const addedLogs: Array<TLog> = []
	for (const logToAdd of sortedLogs) {
		// we may already have this log because two filters can return the same log
		if (logHistory.some(logInHistory => logInHistory!.blockHash === logToAdd.blockHash && logInHistory!.logIndex === logToAdd.logIndex)) continue;
		ensureOrder(logHistory.last(), logToAdd);
		logHistory = logHistory.push(logToAdd)
		addedLogs.push(logToAdd)
	}
	// CONSIDER: the user getting this notification won't have any visibility into the updated log history yet. should we announce new logs in a `setTimeout`? should we provide log history with new logs?
	await onLogsAdded(blockHash, addedLogs)
	return logHistory;
}

const pruneOldLogs = async <TBlock extends Block, TLog extends Log>(logHistory: LogHistory<TLog>, newBlock: TBlock, historyBlockLength: number): Promise<LogHistory<TLog>> => {
	// `log!` is required until the next major version of `immutable` is published to NPM (current version 3.8.2) which improves the type definitions
	return logHistory.skipUntil(log => parseHexInt(newBlock.number) - parseHexInt(log!.blockNumber) < historyBlockLength).toList();
}

const ensureOrder = <TLog extends Log>(headLog: TLog | undefined, newLog: TLog) => {
	if (headLog === undefined) return;
	const headBlockNumber = parseHexInt(headLog.blockNumber);
	const newLogBlockNumber = parseHexInt(newLog.blockNumber);
	if (headBlockNumber > newLogBlockNumber) throw new Error(`received log for a block (${newLogBlockNumber}) older than current head log's block (${headBlockNumber})`);
	if (headBlockNumber !== newLogBlockNumber) return;
	const headLogIndex = parseHexInt(headLog.logIndex);
	const newLogIndex = parseHexInt(newLog.logIndex);
	if (headLogIndex >= newLogIndex) throw new Error(`received log with same block number (${newLogBlockNumber}) but index (${newLogIndex}) is the same or older than previous index (${headLogIndex})`);
}

export const reconcileLogHistoryWithRemovedBlock = async <TBlock extends Block, TLog extends Log>(
	logHistory: LogHistory<TLog>|Promise<LogHistory<TLog>>,
	removedBlock: TBlock,
	onLogsRemoved: (blockHash: string, logs: Array<TLog>) => Promise<void>,
): Promise<LogHistory<TLog>> => {
	logHistory = await logHistory;

	const removedLogs = []
	while (!logHistory.isEmpty() && logHistory.last().blockHash === removedBlock.hash) {
		removedLogs.push(logHistory.last());
		logHistory = logHistory.pop();
	}
	await onLogsRemoved(removedBlock.hash, removedLogs);

	// sanity check, no known way to trigger the error
	if (logHistory.some(log => log!.blockHash === removedBlock.hash)) throw new Error("found logs for removed block not at head of log history");

	return logHistory;
}
