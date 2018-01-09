import { Block } from "./models/block";
import { Log } from "./models/log";
import { Filter, FilterOptions } from "./models/filters";
import { BlockHistory } from "./models/block-history";
import { LogHistory } from "./models/log-history";
import { reconcileBlockHistory } from "./block-reconciler";
import { reconcileLogHistoryWithAddedBlock, reconcileLogHistoryWithRemovedBlock } from "./log-reconciler";

import { List as ImmutableList } from "immutable";
import * as createUuid from "uuid";

export class BlockAndLogStreamer<TBlock extends Block, TLog extends Log> {
	private blockHistory: Promise<BlockHistory<TBlock>> = Promise.resolve(ImmutableList<TBlock>());
	private logHistory: Promise<LogHistory<TLog>> = Promise.resolve(ImmutableList<TLog>());
	private latestBlock: TBlock | null = null;

	private readonly blockRetention: number;

	private readonly getBlockByHash: (hash: string) => Promise<TBlock | null>;
	private readonly getLogs: (filterOptions: FilterOptions) => Promise<TLog[]>;

	private readonly logFilters: { [propName: string]: Filter } = {}
	private readonly onBlockAddedSubscribers: { [propName: string]: (block: TBlock) => void } = {};
	private readonly onBlockRemovedSubscribers: { [propName: string]: (block: TBlock) => void } = {};
	private readonly onLogAddedSubscribers: { [propName: string]: (log: TLog) => void } = {};
	private readonly onLogRemovedSubscribers: { [propName: string]: (log: TLog) => void } = {};

	constructor(
		getBlockByHash: (hash: string) => Promise<TBlock | null>,
		getLogs: (filterOptions: FilterOptions) => Promise<TLog[]>,
		configuration?: { blockRetention?: number },
	) {
		this.getBlockByHash = getBlockByHash;
		this.getLogs = getLogs;
		this.blockRetention = (configuration && configuration.blockRetention) ? configuration.blockRetention : 100;
	}

	static createCallbackStyle = <TBlock extends Block, TLog extends Log>(
		getBlockByHash: (hash: string, callback: (error?: Error, block?: TBlock | null) => void) => void,
		getLogs: (filterOptions: FilterOptions, callback: (error?: Error, logs?: TLog[]) => void) => void,
		configuration?: { blockRetention?: number },
	): BlockAndLogStreamer<TBlock, TLog> => {
		const wrappedGetBlockByHash = (hash: string): Promise<TBlock | null> => {
			return new Promise<TBlock | null>((resolve, reject) => {
				getBlockByHash(hash, (error, block) => {
					if (error) throw error;
					else resolve(block);
				});
			});
		};
		const wrappedGetLogs = (filterOptions: FilterOptions): Promise<Array<TLog>> => new Promise<Array<TLog>>((resolve, reject) => {
			getLogs(filterOptions, (error, logs) => {
				if (error) throw error;
				if (!logs) throw new Error("Received null/undefined logs and no error.");
				resolve(logs);
			});
		});
		return new BlockAndLogStreamer<TBlock, TLog>(wrappedGetBlockByHash, wrappedGetLogs, configuration);
	}

	public readonly reconcileNewBlock = async (block: TBlock): Promise<void> => {
		this.blockHistory = reconcileBlockHistory(this.getBlockByHash, this.blockHistory, block, this.onBlockAdded, this.onBlockRemoved, this.blockRetention);
		const blockHistory = await this.blockHistory;
		this.latestBlock = blockHistory.last();
	};

	public readonly reconcileNewBlockCallbackStyle = async (block: TBlock, callback: (error?: Error) => void): Promise<void> => {
		this.reconcileNewBlock(block)
			.then(() => callback(undefined))
			.catch(error => callback(error));
	};

	private readonly onBlockAdded = async (block: TBlock): Promise<void> => {
		const logFilters = Object.keys(this.logFilters).map(key => this.logFilters[key]);
		this.logHistory = reconcileLogHistoryWithAddedBlock(this.getLogs, this.logHistory, block, this.onLogAdded, logFilters, this.blockRetention);

		await this.logHistory;
		Object.keys(this.onBlockAddedSubscribers)
			.map((key: string) => this.onBlockAddedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback))
			.forEach(callback => callback(block));
	};

	private readonly onBlockRemoved = async (block: TBlock): Promise<void> => {
		this.logHistory = reconcileLogHistoryWithRemovedBlock(this.logHistory, block, this.onLogRemoved);

		await this.logHistory;
		Object.keys(this.onBlockRemovedSubscribers)
			.map((key: string) => this.onBlockRemovedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback))
			.forEach(callback => callback(block));
	};

	private readonly onLogAdded = async (log: TLog): Promise<void> => {
		Object.keys(this.onLogAddedSubscribers)
			.map((key: string) => this.onLogAddedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback))
			.forEach(callback => callback(log));
	};

	private readonly onLogRemoved = async (log: TLog): Promise<void> => {
		Object.keys(this.onLogRemovedSubscribers)
			.map((key: string) => this.onLogRemovedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback))
			.forEach(callback => callback(log));
	};


	public readonly getLatestReconciledBlock = (): TBlock | null => {
		return this.latestBlock;
	};


	public readonly addLogFilter = (filter: Filter): string => {
		const uuid = `log filter token ${createUuid()}`;
		this.logFilters[uuid] = filter;
		return uuid;
	};

	public readonly removeLogFilter = (token: string): void => {
		if (!token.startsWith("log filter token ")) throw new Error(`Expected a log filter token.  Actual: ${token}`);
		delete this.logFilters[token];
	};


	public readonly subscribeToOnBlockAdded = (onBlockAdded: (block: TBlock) => void): string => {
		const uuid = `on block added token ${createUuid()}`;
		this.onBlockAddedSubscribers[uuid] = onBlockAdded;
		return uuid;
	};

	public readonly unsubscribeFromOnBlockAdded = (token: string) => {
		if (!token.startsWith("on block added token ")) throw new Error(`Expected a block added subscription token.  Actual: ${token}`);
		delete this.onBlockAddedSubscribers[token];
	};


	public readonly subscribeToOnBlockRemoved = (onBlockRemoved: (block: TBlock) => void): string => {
		const uuid = `on block removed token ${createUuid()}`;
		this.onBlockRemovedSubscribers[uuid] = onBlockRemoved;
		return uuid;
	};

	public readonly unsubscribeFromOnBlockRemoved = (token: string) => {
		if (!token.startsWith("on block removed token ")) throw new Error(`Expected a block added subscription token.  Actual: ${token}`);
		delete this.onBlockRemovedSubscribers[token];
	};


	public readonly subscribeToOnLogAdded = (onLogAdded: (log: TLog) => void): string => {
		const uuid = `on log added token ${createUuid()}`;
		this.onLogAddedSubscribers[uuid] = onLogAdded;
		return uuid;
	};

	public readonly unsubscribeFromOnLogAdded = (token: string) => {
		if (!token.startsWith("on log added token ")) throw new Error(`Expected a log added subscription token.  Actual: ${token}`);
		delete this.onLogAddedSubscribers[token];
	};


	public readonly subscribeToOnLogRemoved = (onLogRemoved: (log: TLog) => void): string => {
		const uuid = `on log removed token ${createUuid()}`;
		this.onLogRemovedSubscribers[uuid] = onLogRemoved;
		return uuid;
	};

	public readonly unsubscribeFromOnLogRemoved = (token: string) => {
		if (!token.startsWith("on log removed token ")) throw new Error(`Expected a log added subscription token.  Actual: ${token}`);
		delete this.onLogRemovedSubscribers[token];
	};
}

function logAndSwallowWrapper<T>(callback: (arg: T) => void): (arg: T) => void {
	return function (parameter) {
		try {
			callback(parameter);
		} catch (error) {
			console.log(error);
		}
	};
}
