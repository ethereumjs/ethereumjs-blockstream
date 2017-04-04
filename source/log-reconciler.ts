import { Block } from "./models/block";
import { BlockHistory } from "./models/block-history";
import { Log } from "./models/log";
import { Filter, FilterOptions } from "./models/filters";
import { LogHistory } from "./models/log-history";
import { List as ImmutableList } from "immutable";

export async function reconcileLogHistoryWithAddedBlock(
	getLogs: (filterOptions: FilterOptions) => Promise<Log[]>,
	logHistory: LogHistory | Promise<LogHistory>,
	newBlock: Block,
	onLogAdded: (log: Log) => Promise<void>,
	filters: Filter[] = [],
	historyBlockLength: number = 100,
): Promise<LogHistory> {
	logHistory = await logHistory;
	const logs = await getFilteredLogs(getLogs, newBlock, filters);
	logHistory = await addNewLogsToHead(logHistory, logs, onLogAdded);
	logHistory = await pruneOldLogs(logHistory, newBlock, historyBlockLength);
	return logHistory;
	// TODO: validate logs are part of expected block hash
}

async function getFilteredLogs(getLogs: (filterOptions: FilterOptions) => Promise<Log[]>, newBlock: Block, filters: Filter[]): Promise<Log[]> {
	const logPromises = filters
		.map(filter => ({ fromBlock: newBlock.number, toBlock: newBlock.number, address: filter.address, topics: filter.topics, }))
		.map(filter => getLogs(filter));
	return await Promise.all(logPromises)
		.then(nestedLogs => nestedLogs.reduce((allLogs, logs) => allLogs.concat(logs), []));
}

async function addNewLogsToHead(logHistory: LogHistory, newLogs: Log[], onLogAdded: (log: Log) => Promise<void>): Promise<LogHistory> {
	const sortedLogs = newLogs.sort((logA, logB) => parseInt(logA.logIndex, 16) - parseInt(logB.logIndex, 16));
	for (const log of sortedLogs) {
		ensureOrder(logHistory.last(), log);
		logHistory = await addNewLogToHead(logHistory, log, onLogAdded);
	}
	return logHistory;
}

async function pruneOldLogs(logHistory: LogHistory, newBlock: Block, historyBlockLength: number): Promise<LogHistory> {
	// `logBlock!` is required until the next version of `immutable` is published to NPM (current version 3.8.1) which improves the type definitions
	return logHistory.skipUntil(log => parseInt(newBlock!.number, 16) - parseInt(log!.blockNumber, 16) < historyBlockLength).toList();
}

async function addNewLogToHead(logHistory: LogHistory, newLog: Log, onLogAdded: (log: Log) => Promise<void>): Promise<LogHistory> {
	logHistory = logHistory.push(newLog);
	// CONSIDER: the user getting this notification won't have any visibility into the updated log history yet. should we announce new logs in a `setTimeout`? should we provide log history with new logs?
	await onLogAdded(newLog);
	return logHistory;
}

function ensureOrder(headLog: Log | undefined, newLog: Log) {
	if (headLog === undefined) return;
	const headBlockNumber = parseInt(headLog.blockNumber, 16);
	const newLogBlockNumber = parseInt(newLog.blockNumber, 16);
	if (headBlockNumber > newLogBlockNumber) throw new Error("received log for a block older than current head log's block");
	if (headBlockNumber !== newLogBlockNumber) return;
	const headLogIndex = parseInt(headLog.logIndex, 16);
	const newLogIndex = parseInt(newLog.logIndex, 16);
	if (headLogIndex >= newLogIndex) throw new Error("received log with same block number but index newer than previous index");
}

export async function reconcileLogHistoryWithRemovedBlock(
	logHistory: LogHistory|Promise<LogHistory>,
	removedBlock: Block,
	onLogRemoved: (log: Log) => Promise<void>,
): Promise<LogHistory> {
	logHistory = await logHistory;

	while (!logHistory.isEmpty() && logHistory.last().blockHash === removedBlock.hash) {
		await onLogRemoved(logHistory.last());
		logHistory = logHistory.pop();
	}

	// sanity check, no known way to trigger the error
	if (logHistory.some(log => log!.blockHash === removedBlock.hash)) throw new Error("found logs for removed block not at head of log history");

	return logHistory;
}
