import { reconcileBlockHistory } from "../source/block-reconciler";
import { reconcileLogHistoryWithAddedBlock, reconcileLogHistoryWithRemovedBlock } from "../source/log-reconciler";
import { Block, Log, FilterOptions, BlockAndLogStreamer } from "../source/index";
import { MockBlock, MockLog, getBlockByHashFactory, getLogsFactory, delay } from "./helpers";
import { expect, use as chaiUse } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as chaiImmutable from "chai-immutable";
import { List as ImmutableList, Record as ImmutableRecord, fromJS } from "immutable";
import "mocha";

chaiUse(chaiImmutable);
chaiUse(chaiAsPromised);

describe("reconcileBlockHistory", () => {
	let newBlockAnnouncements: Block[];
	let blockRemovalAnnouncments: Block[];
	const onBlockAdded = async (block: Block) => { await delay(0); newBlockAnnouncements.push(block); };
	const onBlockRemoved = async (block: Block) => { await delay(0); blockRemovalAnnouncments.push(block); };

	beforeEach(() => {
		newBlockAnnouncements = [];
		blockRemovalAnnouncments = [];
	});

	it("announces new head when first block is added to history", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>());
		const newBlock = new MockBlock(0x7777);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([newBlock]);
		expect(newBlockAnnouncements).to.deep.include(newBlock);
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("does not announce new block on repeat of current head", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([new MockBlock(0x7777)]));
		const newBlock = new MockBlock(0x7777);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory).to.equal(await oldHistory);
		expect(newBlockAnnouncements).to.be.empty;
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("announces a new head when nth block is added to history", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778)
		]));
		const newBlock = new MockBlock(0x7779);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779)
		]);
		expect(newBlockAnnouncements).to.deep.equal([newBlock]);
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("ignores blocks already in history", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779)
		]));
		const newBlock = new MockBlock(0x7778);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory).to.equal(await oldHistory);
		expect(newBlockAnnouncements).to.be.empty;
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("does a multi-block rollback to attach new block to head", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779),
			new MockBlock(0x777A)
		]));
		const newBlock = new MockBlock(0x7779, "BBBB", "AAAA");

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7777, "AAAA"),
			new MockBlock(0x7778, "AAAA"),
			new MockBlock(0x7779, "BBBB", "AAAA")
		]);
		expect(newHistory.count()).to.equal(3);
		expect(newBlockAnnouncements).to.deep.equal([newBlock]);
		expect(blockRemovalAnnouncments).to.deep.equal([
			new MockBlock(0x777A),
			new MockBlock(0x7779)
		]);
	});

	it("backfills missing blocks", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778)
		]));
		const newBlock = new MockBlock(0x777B);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779),
			new MockBlock(0x777A),
			new MockBlock(0x777B)
		]);
		expect(newBlockAnnouncements).to.deep.equal([
			new MockBlock(0x7779),
			new MockBlock(0x777A),
			new MockBlock(0x777B)
		]);
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("rolls back and backfills if necessary", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779),
			new MockBlock(0x777A)
		]));
		const newBlock = new MockBlock(0x777B, "BBBB", "BBBB");
		const getBlockByHash = getBlockByHashFactory([
			new MockBlock(0x777A, "BBBB", "BBBB"),
			new MockBlock(0x7779, "BBBB", "AAAA")
		]);

		const newHistory = await reconcileBlockHistory(getBlockByHash, oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7777, "AAAA", "AAAA"),
			new MockBlock(0x7778, "AAAA", "AAAA"),
			new MockBlock(0x7779, "BBBB", "AAAA"),
			new MockBlock(0x777A, "BBBB", "BBBB"),
			new MockBlock(0x777B, "BBBB", "BBBB"),
		]);
		expect(newBlockAnnouncements).to.deep.equal([
			new MockBlock(0x7779, "BBBB", "AAAA"),
			new MockBlock(0x777A, "BBBB", "BBBB"),
			new MockBlock(0x777B, "BBBB", "BBBB"),
		]);
		expect(blockRemovalAnnouncments).to.deep.equal([
			new MockBlock(0x777A, "AAAA", "AAAA"),
			new MockBlock(0x7779, "AAAA", "AAAA"),
		]);
	});

	it("resets history if reconciliation not possible", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778)
		]));
		const newBlock = new MockBlock(0x7778, "BBBB", "BBBB");

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved, 5);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7776, "BBBB", "BBBB"),
			new MockBlock(0x7777, "BBBB", "BBBB"),
			new MockBlock(0x7778, "BBBB", "BBBB"),
		]);
		expect(newBlockAnnouncements).to.deep.equal([
			new MockBlock(0x7776, "BBBB", "BBBB"),
			new MockBlock(0x7777, "BBBB", "BBBB"),
			new MockBlock(0x7778, "BBBB", "BBBB"),
		]);
		expect(blockRemovalAnnouncments).to.deep.equal((await oldHistory).reverse().toJS());
	});

	it("throws if block fetching of parent during backfill fails", async () => {
		const getBlockByHash = async (hash: string): Promise<Block | null> => { await delay(0); return null; }
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778)
		]));
		const newBlock = new MockBlock(0x777B);

		const newHistoryPromise = reconcileBlockHistory(getBlockByHash, oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		await expect(newHistoryPromise).to.eventually.be.rejectedWith(Error, "Failed to fetch parent block.");
		expect(newBlockAnnouncements).to.be.empty;
		expect(blockRemovalAnnouncments).to.be.empty;
	});

	it("wipes out history if new block is older than oldest block in history", async () => {
		const oldHistory = Promise.resolve(ImmutableList<Block>([
			new MockBlock(0x7777),
			new MockBlock(0x7778),
			new MockBlock(0x7779),
			new MockBlock(0x777A),
		]));
		const newBlock = new MockBlock(0x7776);

		const newHistory = await reconcileBlockHistory(getBlockByHashFactory(), oldHistory, newBlock, onBlockAdded, onBlockRemoved);

		expect(newHistory.toJS()).to.deep.equal([
			new MockBlock(0x7776),
		]);
		expect(newBlockAnnouncements).to.deep.equal([
			new MockBlock(0x7776),
		]);
		expect(blockRemovalAnnouncments).to.deep.equal([
			new MockBlock(0x777A),
			new MockBlock(0x7779),
			new MockBlock(0x7778),
			new MockBlock(0x7777),
		])
	})
});

describe("reconcileLogHistoryWithAddedBlock", async () => {
	let newLogAnnouncements: Array<Log>;
	const onLogsAdded = async (blockHash: string, logs: Array<Log>) => { await delay(0); logs.forEach(log => newLogAnnouncements.push(log)); };

	beforeEach(() => {
		newLogAnnouncements = [];
	});

	it("does not fetch logs if no filters are applied", async () => {
		let called = 0;
		const getLogs = async (filterOptions: FilterOptions): Promise<Log[]> => { ++called; return Promise.resolve([]); };
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded);

		expect(newLogHistory).to.deep.equal(ImmutableList<Log>());
		expect(newLogAnnouncements).to.be.empty;
		expect(called).to.equal(0);
	});

	it("adds block with no logs", async () => {
		const getLogs = async (filterOptions: FilterOptions) => Promise.resolve([]);
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{}]);

		expect(newLogHistory).to.deep.equal(ImmutableList<Log>());
		expect(newLogAnnouncements).to.be.empty;
	});

	it("adds block with logs", async () => {
		const getLogs = getLogsFactory(1);
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{}]);

		// unfortunately, because we have an immutable list of a complex object with a nested list of a complex object in it, we can't do a normal equality comparison
		expect(newLogHistory.toJS()).to.deep.equal([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777')]);
		expect(newLogAnnouncements).to.deep.equal([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777')]);
	});

	it("adds block with multiple logs", async () => {
		const getLogs = getLogsFactory(2);
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{}]);

		// unfortunately, because we have an immutable list of a complex object with a nested list of a complex object in it, we can't do a normal equality comparison
		expect(newLogHistory.toJS()).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]);
		expect(newLogAnnouncements).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]);
	});

	it("orders logs by index", async () => {
		const getLogs = async (filterOptions: FilterOptions) => Promise.resolve([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x2),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x3),
		]);
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{}]);

		expect(newLogHistory.toJS()).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x2),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x3),
		]);
		expect(newLogAnnouncements).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x2),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x3),
		]);
	});

	it("fails if getLogs fails", async () => {
		const getLogs = async (filterOptions: FilterOptions) => { await delay(0); throw new Error("apple"); };
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistoryPromise = reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{}]);

		await expect(newLogHistoryPromise).to.eventually.be.rejectedWith(Error, "apple");
		expect(newLogAnnouncements).to.be.empty;
	});

	it("fails if onNewLog fails", async () => {
		const getLogs = getLogsFactory(1);
		const failingOnLogAdded = async () => { await delay(0); throw new Error("banana"); };
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistoryPromise = reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, failingOnLogAdded, [{}]);

		await expect(newLogHistoryPromise).to.eventually.rejectedWith(Error, "banana");
	});

	it("fails if old block with logs is added before new block with logs is removed", async () => {
		const getLogs = getLogsFactory(1);
		const firstBlock = new MockBlock(0x7777);
		const secondBlock = new MockBlock(0x7776);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const firstLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, firstBlock, onLogsAdded, [{}]);
		const secondLogHistoryPromise = reconcileLogHistoryWithAddedBlock(getLogs, firstLogHistory, secondBlock, onLogsAdded, [{}]);

		await expect(secondLogHistoryPromise).to.eventually.rejectedWith(Error, /received log for a block (.*?) older than current head log's block (.*?)/);
		// unfortunate reality
		expect(newLogAnnouncements).to.deep.equal([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777')]);
	})

	it("dedupes logs with same blockhash and index from multiple filters", async () => {
		const getLogs = async (filterOptions: FilterOptions) => Promise.resolve([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]);
		const newBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithAddedBlock(getLogs, oldLogHistory, newBlock, onLogsAdded, [{},{}]);

		expect(newLogAnnouncements).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]);
	});
});

describe("reconcileLogHistoryWithRemovedBlock", async () => {
	let removedLogAnnouncements: Array<Log>;
	const onLogsRemoved = async (blockHash: string, logs: Array<Log>) => { await delay(0); logs.forEach(log => removedLogAnnouncements.push(log)); };

	beforeEach(() => {
		removedLogAnnouncements = [];
	});

	it("returns empty log history when starting with null log", async () => {
		const removedBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>());

		const newLogHistory = await reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		expect(newLogHistory.toJS()).to.be.empty;
		expect(removedLogAnnouncements).to.be.empty;
	});

	it("handles block removal with no associated logs", async () => {
		const removedBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776')]));

		const newLogHistory = await reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		expect(newLogHistory.toJS()).to.deep.equal([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776')]);
		expect(removedLogAnnouncements).to.be.empty;
	});

	it("removes logs at head for given block", async () => {
		const removedBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777'),
		]));

		const newLogHistory = await reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		expect(newLogHistory.toJS()).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
		]);
		expect(removedLogAnnouncements).to.deep.equal([new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777')]);
	});

	it("removes multiple logs in reverse order for same block", async () => {
		const removedBlock = new MockBlock(0x7777);
		// NOTE: log index sorting is handled on new block processing but not validated during removal process so out-of-order indexes are only possible by manually creating history
		const oldLogHistory = Promise.resolve(ImmutableList<Log>([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x2),
		]));

		const newLogHistory = await reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		expect(newLogHistory.toJS()).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
		]);
		expect(removedLogAnnouncements).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x2),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]);
	});

	it("throws if removed block is not at head", async () => {
		const removedBlock = new MockBlock(0x7776);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777'),
		]));

		const newLogHistoryPromise = reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		await expect(newLogHistoryPromise).to.eventually.rejectedWith(Error, "found logs for removed block not at head of log history");
		expect(removedLogAnnouncements).to.be.empty;
	});

	it("removes head logs for block before throwing upon finding nonhead logs for block", async () => {
		const removedBlock = new MockBlock(0x7777);
		const oldLogHistory = Promise.resolve(ImmutableList<Log>([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7775'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7776'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
		]));

		const newLogHistoryPromise = reconcileLogHistoryWithRemovedBlock(oldLogHistory, removedBlock, onLogsRemoved);

		await expect(newLogHistoryPromise).to.eventually.rejectedWith(Error, "found logs for removed block not at head of log history");
		expect(removedLogAnnouncements).to.deep.equal([
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x1),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0x0),
		]);
	});
});

describe("BlockAndLogStreamer", async () => {
	let blockAndLogStreamer: BlockAndLogStreamer<Block, Log>;
	let announcements: {addition: boolean, item: Block|Log|Error}[];
	const onBlockAdded = (block: Block) => announcements.push({addition: true, item: block});
	const onBlockRemoved = (block: Block) => announcements.push({addition: false, item: block});
	const onLogsAdded = (blockHash: string, logs: Array<Log>) => logs.forEach(log => announcements.push({addition: true, item: log}));
	const onLogsRemoved = (blockHash: string, logs: Array<Log>) => logs.forEach(log => announcements.push({addition: false, item: log}));
	const onError = (error: any) => announcements.push({addition: true, item: error});

	const reinitialize = (getBlockByHash: (hash: string) => Promise<Block|null>, getLogs: (filterOptions: FilterOptions) => Promise<Log[]>) => {
		blockAndLogStreamer = new BlockAndLogStreamer(getBlockByHash, getLogs, onError, { blockRetention: 5 });
		blockAndLogStreamer.addLogFilter({});
		blockAndLogStreamer.subscribeToOnBlockAdded(onBlockAdded);
		blockAndLogStreamer.subscribeToOnBlockRemoved(onBlockRemoved);
		blockAndLogStreamer.subscribeToOnLogsAdded(onLogsAdded);
		blockAndLogStreamer.subscribeToOnLogsRemoved(onLogsRemoved);
		announcements = [];
	}

	beforeEach(() => {
		reinitialize(getBlockByHashFactory(), getLogsFactory(1));
	});

	it("announces new blocks and logs", async () => {
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));

		expect(announcements).to.deep.equal([
			{addition: true, item: new MockBlock(0x7777)},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0)},
		]);
	});

	it("announces removed blocks and logs", async () => {
		const logs = [ new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0, 'AAAA'), new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'AAAA'), new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'BBBB') ];
		const getLogs = async (filterOptions: FilterOptions) => [logs.shift()!];
		reinitialize(getBlockByHashFactory(), getLogs);

		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777, "AAAA"));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7778, "AAAA"));
		announcements = [];

		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7778, "BBBB", "AAAA"));

		expect(announcements).to.deep.equal([
			{addition: false, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'AAAA')},
			{addition: false, item: new MockBlock(0x7778, "AAAA", "AAAA")},
			{addition: true, item: new MockBlock(0x7778, "BBBB", "AAAA")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'BBBB')},
		]);
	});

	it("latest block is latest fully reconciled block", async () => {
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));
		const promise = blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779));

		expect(blockAndLogStreamer.getLatestReconciledBlock()).to.deep.equal(new MockBlock(0x7777));
		await promise;
		expect(blockAndLogStreamer.getLatestReconciledBlock()).to.deep.equal(new MockBlock(0x7779));
	});

	it("adding multiple blocks in quick succession results in expected callbacks", async () => {
		const logs = [
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, 'BBBB'),
		];
		const getLogs = async (filterOptions: FilterOptions) => [logs.shift()!];
		reinitialize(getBlockByHashFactory(), getLogs);
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777, "AAAA", "AAAA"));
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "AAAA", "AAAA"));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "BBBB", "AAAA"));

		expect(announcements).to.deep.equal([
			{addition: true, item: new MockBlock(0x7777, "AAAA", "AAAA")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0)},
			{addition: true, item: new MockBlock(0x7778, "AAAA", "AAAA")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0)},
			{addition: true, item: new MockBlock(0x7779, "AAAA", "AAAA")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0)},
			{addition: false, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0)},
			{addition: false, item: new MockBlock(0x7779, "AAAA", "AAAA")},
			{addition: true, item: new MockBlock(0x7779, "BBBB", "AAAA")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, "BBBB")},
		]);
	});

	it("swallows errors from callbacks", async () => {
		const logs = [
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, 'AAAA'),
			new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, 'BBBB'),
		];
		const getLogs = async (filterOptions: FilterOptions) => [logs.shift()!];
		reinitialize(getBlockByHashFactory(), getLogs);

		blockAndLogStreamer.subscribeToOnBlockAdded(block => { throw new Error("apple"); });
		blockAndLogStreamer.subscribeToOnBlockRemoved(block => { throw new Error("banana"); });
		blockAndLogStreamer.subscribeToOnLogsAdded(logs => { throw new Error("cherry"); });
		blockAndLogStreamer.subscribeToOnLogsRemoved(logs => { throw new Error("durian") });

		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777, "AAAA", "AAAA"));
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "AAAA", "AAAA"));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "BBBB", "AAAA"));

		expect(announcements).to.deep.equal([
			{addition: true, item: new MockBlock(0x7777, "AAAA", "AAAA")},
			{addition: true, item: new Error("apple")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0)},
			{addition: true, item: new Error("cherry")},
			{addition: true, item: new MockBlock(0x7778, "AAAA", "AAAA")},
			{addition: true, item: new Error("apple")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0)},
			{addition: true, item: new Error("cherry")},
			{addition: true, item: new MockBlock(0x7779, "AAAA", "AAAA")},
			{addition: true, item: new Error("apple")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0)},
			{addition: true, item: new Error("cherry")},
			{addition: false, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0)},
			{addition: true, item: new Error("durian")},
			{addition: false, item: new MockBlock(0x7779, "AAAA", "AAAA")},
			{addition: true, item: new Error("banana")},
			{addition: true, item: new MockBlock(0x7779, "BBBB", "AAAA")},
			{addition: true, item: new Error("apple")},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0, "BBBB")},
			{addition: true, item: new Error("cherry")},
		]);
	});

	it("unsubscribes correctly", async () => {
		const addBlockToken = blockAndLogStreamer.subscribeToOnBlockAdded(block => expect(true).to.be.false);
		blockAndLogStreamer.unsubscribeFromOnBlockAdded(addBlockToken);
		const removeBlockToken = blockAndLogStreamer.subscribeToOnBlockRemoved(block => expect(true).to.be.false);
		blockAndLogStreamer.unsubscribeFromOnBlockRemoved(removeBlockToken);
		const addLogToken = blockAndLogStreamer.subscribeToOnLogsAdded(block => expect(true).to.be.false);
		blockAndLogStreamer.unsubscribeFromOnLogsAdded(addLogToken);
		const removeLogToken = blockAndLogStreamer.subscribeToOnLogsRemoved(block => expect(true).to.be.false);
		blockAndLogStreamer.unsubscribeFromOnLogsRemoved(removeLogToken);
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777, "AAAA", "AAAA"));
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "AAAA", "AAAA"));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, "AAAA", "BBBB"));
	});

	it("throws if unsubscribing with invalid token", async () => {
		const addBlockToken = blockAndLogStreamer.subscribeToOnBlockAdded(_ => { });
		const removeBlockToken = blockAndLogStreamer.subscribeToOnBlockRemoved(_ => { });
		expect(() => blockAndLogStreamer.unsubscribeFromOnBlockAdded(removeBlockToken)).to.throw(Error);
		expect(() => blockAndLogStreamer.unsubscribeFromOnBlockRemoved(addBlockToken)).to.throw(Error);
		expect(() => blockAndLogStreamer.unsubscribeFromOnLogsAdded(addBlockToken)).to.throw(Error);
		expect(() => blockAndLogStreamer.unsubscribeFromOnLogsRemoved(addBlockToken)).to.throw(Error);
	});

	it("calls getLogs multiple times for multiple filters", async () => {
		let getLogsCallCount = 0;
		const getLogs = async (filter: FilterOptions) => {
			++getLogsCallCount;
			return [];
		}
		blockAndLogStreamer = new BlockAndLogStreamer(getBlockByHashFactory(), getLogs, onError);
		blockAndLogStreamer.addLogFilter({ address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", topics: [] });
		blockAndLogStreamer.addLogFilter({ address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", topics: ["0xbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbaadf00d"] });
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));

		expect(getLogsCallCount).to.equal(2);
	});

	it("doesn't call getLogs if no filters are attached", async () => {
		let getLogsCallCount = 0;
		const getLogs = async (filter: FilterOptions) => {
			++getLogsCallCount;
			return [];
		}
		blockAndLogStreamer = new BlockAndLogStreamer(getBlockByHashFactory(), getLogs, onError);
		const filterAToken = blockAndLogStreamer.addLogFilter({ address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", topics: [] });
		const filterBToken = blockAndLogStreamer.addLogFilter({ address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", topics: ["0xbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbaadf00d"] });
		blockAndLogStreamer.removeLogFilter(filterAToken);
		blockAndLogStreamer.removeLogFilter(filterBToken);
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));

		expect(getLogsCallCount).to.equal(0);
	});

	it("does not announce or make changes to state if we can't fetch a parent block", async () => {
		const defaultGetBlockByHash = getBlockByHashFactory();
		const getBlockByHash = async (hash: string) => (hash === '0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cBBBB7778') ? null : defaultGetBlockByHash(hash);
		reinitialize(getBlockByHash, getLogsFactory(1));

		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7778));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, 'BBBB', 'BBBB')).catch(() => {});
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779));

		expect(announcements).to.deep.equal([
			{addition: true, item: new MockBlock(0x7777)},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7777', 0)},
			{addition: true, item: new MockBlock(0x7778)},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7778', 0)},
			{addition: true, item: new MockBlock(0x7779)},
			{addition: true, item: new MockLog('0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cAAAA7779', 0)},
		]);
	});

	it("non-awaited reconciliation failure will result in failure of following reconciliation", async () => {
		const defaultGetBlockByHash = getBlockByHashFactory();
		const getBlockByHash = async (hash: string) => (hash === '0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cBBBB7778') ? null : defaultGetBlockByHash(hash);
		reinitialize(getBlockByHash, getLogsFactory(0));

		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7777));
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7778));
		blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779, 'BBBB', 'BBBB')).catch(() => {});
		await blockAndLogStreamer.reconcileNewBlock(new MockBlock(0x7779)).catch(() => {});

		expect(announcements).to.deep.equal([
			{addition: true, item: new MockBlock(0x7777)},
			{addition: true, item: new MockBlock(0x7778)},
		]);
	});
});
