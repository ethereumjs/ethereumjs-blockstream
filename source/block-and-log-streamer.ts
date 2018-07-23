import { Block } from "./models/block";
import { Log } from "./models/log";
import { Filter, FilterOptions } from "./models/filters";
import { BlockHistory } from "./models/block-history";
import { LogHistory } from "./models/log-history";
import { reconcileBlockHistory } from "./block-reconciler";
import { reconcileLogHistoryWithAddedBlock, reconcileLogHistoryWithRemovedBlock } from "./log-reconciler";

import { List as ImmutableList } from "immutable";
import * as createUuid from "uuid";

export interface Configuration {
	/** number of blocks to retain in history, defaults to 100 */
	blockRetention?: number
}

export class BlockAndLogStreamer<TBlock extends Block, TLog extends Log> {
	private lastKnownGoodBlockHistory: BlockHistory<TBlock> = ImmutableList<TBlock>();
	private blockHistory: Promise<BlockHistory<TBlock>> = Promise.resolve(this.lastKnownGoodBlockHistory);
	private lastKnownGoodLogHistory: LogHistory<TLog> = ImmutableList<TLog>();
	private logHistory: Promise<LogHistory<TLog>> = Promise.resolve(this.lastKnownGoodLogHistory);
	private pendingCallbacks: Array<() => void> = [];

	private readonly blockRetention: number;

	private readonly getBlockByHash: (hash: string) => Promise<TBlock | null>;
	private readonly getLogs: (filterOptions: FilterOptions) => Promise<TLog[]>;
	private readonly onError: (error: Error) => void = () => {};

	private readonly logFilters: { [propName: string]: Filter } = {}
	private readonly onBlockAddedSubscribers: { [propName: string]: (block: TBlock) => void } = {};
	private readonly onBlockRemovedSubscribers: { [propName: string]: (block: TBlock) => void } = {};
	private readonly onLogAddedSubscribers: { [propName: string]: (log: TLog) => void } = {};
	private readonly onLogRemovedSubscribers: { [propName: string]: (log: TLog) => void } = {};

	/**
	 * @param getBlockByHash async function that returns a block given a particular hash or null/throws if the block is not found
	 * @param getLogs async function that returns the logs matching the given filter
	 * @param onError called if a subscriber throws an error, the error will otherwise be swallowed
	 * @param configuration additional optional configuration items
	 */
	constructor(
		getBlockByHash: (hash: string) => Promise<TBlock | null>,
		getLogs: (filterOptions: FilterOptions) => Promise<TLog[]>,
		onError: (error: Error) => void,
		configuration?: Configuration,
	) {
		if (getBlockByHash === undefined) throw new Error(`getBlockByHash must be provided`);
		this.getBlockByHash = getBlockByHash;
		if (getLogs === undefined) throw new Error(`getLogs must be provided`);
		this.getLogs = getLogs;
		if (onError === undefined) throw new Error(`onError must be provided`);
		this.onError = onError;
		this.blockRetention = (configuration && configuration.blockRetention) ? configuration.blockRetention : 100;
	}

	public readonly reconcileNewBlock = async (block: TBlock): Promise<void> => {
		try {
			this.blockHistory = reconcileBlockHistory(this.getBlockByHash, this.blockHistory, block, this.onBlockAdded, this.onBlockRemoved, this.blockRetention);
			const blockHistory = await this.blockHistory;
			const logHistory = await this.logHistory;
			// everything reconciled correctly, checkpoint state
			this.lastKnownGoodBlockHistory = blockHistory;
			this.lastKnownGoodLogHistory = logHistory;
			this.pendingCallbacks.forEach(callback => callback());
			this.pendingCallbacks = [];
		} catch (error) {
			// NOTE: this catch block may be hit multiple times for a single failure root cause, thus we need to be careful to only do idempotent operations in here
			// something went wrong, rollback to last checkpoint
			this.blockHistory = Promise.resolve(this.lastKnownGoodBlockHistory);
			this.logHistory = Promise.resolve(this.lastKnownGoodLogHistory);
			this.pendingCallbacks = [];
			throw error;
		}
	};

	private readonly onBlockAdded = async (block: TBlock): Promise<void> => {
		const logFilters = Object.keys(this.logFilters).map(key => this.logFilters[key]);
		this.logHistory = reconcileLogHistoryWithAddedBlock(this.getLogs, this.logHistory, block, this.onLogAdded, logFilters, this.blockRetention);
		await this.logHistory;

		Object.keys(this.onBlockAddedSubscribers)
			.map((key: string) => this.onBlockAddedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback, this.onError))
			.forEach(callback => this.pendingCallbacks.push(() => callback(block)));
	};

	private readonly onBlockRemoved = async (block: TBlock): Promise<void> => {
		this.logHistory = reconcileLogHistoryWithRemovedBlock(this.logHistory, block, this.onLogRemoved);
		await this.logHistory;

		Object.keys(this.onBlockRemovedSubscribers)
			.map((key: string) => this.onBlockRemovedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback, this.onError))
			.forEach(callback => this.pendingCallbacks.push(() => callback(block)));
	};

	private readonly onLogAdded = async (log: TLog): Promise<void> => {
		Object.keys(this.onLogAddedSubscribers)
			.map((key: string) => this.onLogAddedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback, this.onError))
			.forEach(callback => this.pendingCallbacks.push(() => callback(log)));
	};

	private readonly onLogRemoved = async (log: TLog): Promise<void> => {
		Object.keys(this.onLogRemovedSubscribers)
			.map((key: string) => this.onLogRemovedSubscribers[key])
			.map(callback => logAndSwallowWrapper(callback, this.onError))
			.forEach(callback => this.pendingCallbacks.push(() => callback(log)));
	};


	public readonly getLatestReconciledBlock = (): TBlock | null => {
		return this.lastKnownGoodBlockHistory.isEmpty() ? null : this.lastKnownGoodBlockHistory.last();
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

function logAndSwallowWrapper<T>(callback: (arg: T) => void, onError: (error: Error) => void): (arg: T) => void {
	return function (parameter) {
		try {
			callback(parameter);
		} catch (error) {
			onError(error);
		}
	};
}
