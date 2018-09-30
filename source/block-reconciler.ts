import { Block } from "./models/block";
import { BlockHistory } from "./models/block-history";
import { parseHexInt } from "./utilities";
import { List as ImmutableList } from "immutable";

type GetBlockByHash<TBlock> = (hash: string) => Promise<TBlock|null>;

export const reconcileBlockHistory = async <TBlock extends Block>(
	getBlockByHash: GetBlockByHash<TBlock>,
	blockHistory: BlockHistory<TBlock>|Promise<BlockHistory<TBlock>>,
	newBlock: TBlock,
	onBlockAdded: (block: TBlock) => Promise<void>,
	onBlockRemoved: (block: TBlock) => Promise<void>,
	blockRetention: number = 100,
): Promise<BlockHistory<TBlock>> => {
	blockHistory = await blockHistory;
	if (isFirstBlock(blockHistory))
		return await addNewHeadBlock(blockHistory, newBlock, onBlockAdded, blockRetention);

	if (isOlderThanOldestBlock(blockHistory, newBlock)) {
		blockHistory = await rollback(blockHistory, onBlockRemoved);
		return await addNewHeadBlock(blockHistory, newBlock, onBlockAdded, blockRetention);
	}

	if (isAlreadyInHistory(blockHistory, newBlock))
		return blockHistory;

	if (isNewHeadBlock(blockHistory, newBlock))
		return await addNewHeadBlock(blockHistory, newBlock, onBlockAdded, blockRetention);

	if (parentHashIsInHistory(blockHistory, newBlock)) {
		while (blockHistory.last().hash !== newBlock.parentHash) {
			blockHistory = await removeHeadBlock(blockHistory, onBlockRemoved);
		}
		return await addNewHeadBlock(blockHistory, newBlock, onBlockAdded, blockRetention);
	}

	return await backfill(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention);
}

const rollback = async <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, onBlockRemoved: (block: TBlock) => Promise<void>): Promise<BlockHistory<TBlock>> => {
	while (!blockHistory.isEmpty()) {
		// CONSIDER: if this throws an exception, removals may have been announced that are actually still in history since throwing will result in no history update. we can't catch errors here because there isn't a clear way to recover from them, the failure may be a downstream system telling us that the block removal isn't possible because they are in a bad state. we could try re-announcing the successfully added blocks, but there would still be a problem with the failed block (should it be re-announced?) and the addition announcements may also fail
		blockHistory = await removeHeadBlock(blockHistory, onBlockRemoved);
	}
	return blockHistory;
}

const backfill = async <TBlock extends Block>(getBlockByHash: GetBlockByHash<TBlock>, blockHistory: BlockHistory<TBlock>, newBlock: TBlock, onBlockAdded: (block: TBlock) => Promise<void>, onBlockRemoved: (block: TBlock) => Promise<void>, blockRetention: number): Promise<BlockHistory<TBlock>> => {
	if (newBlock.parentHash === "0x0000000000000000000000000000000000000000000000000000000000000000")
		return await rollback(blockHistory, onBlockRemoved);
	const parentBlock = await getBlockByHash(newBlock.parentHash);
	if (parentBlock === null) throw new Error("Failed to fetch parent block.");
	if (parseHexInt(parentBlock.number) + blockRetention < parseHexInt(blockHistory.last().number))
		return await rollback(blockHistory, onBlockRemoved);
	blockHistory = await reconcileBlockHistory(getBlockByHash, blockHistory, parentBlock, onBlockAdded, onBlockRemoved, blockRetention);
	return await reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention);
}

const addNewHeadBlock = async <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, newBlock: TBlock, onBlockAdded: (block: TBlock) => Promise<void>, blockRetention: number): Promise<BlockHistory<TBlock>> => {
	// this is here as a final sanity check, in case we somehow got into an unexpected state, there are no known (and should never be) ways to reach this exception
	if (!blockHistory.isEmpty() && blockHistory.last().hash !== newBlock.parentHash) throw new Error("New head block's parent isn't our current head.");
	// CONSIDER: the user getting this notification won't have any visibility into the updated block history yet. should we announce new blocks in a `setTimeout`? should we provide block history with new logs? an announcement failure will result in unwinding the stack and returning the original blockHistory, if we are in the process of backfilling we may have already announced previous blocks that won't actually end up in history (they won't get removed if a re-org occurs and may be re-announced). we can't catch errors thrown by the callback because it may be trying to signal to use that the block has become invalid and is un-processable
	await onBlockAdded(newBlock);
	blockHistory = blockHistory.push(newBlock);
	return blockHistory.takeLast(blockRetention).toList();
}

const removeHeadBlock = async <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, onBlockRemoved: (block: TBlock) => Promise<void>): Promise<BlockHistory<TBlock>> => {
	let removedBlock = blockHistory.last();
	blockHistory = blockHistory.pop();
	await onBlockRemoved(removedBlock);
	return blockHistory;
}

const isFirstBlock = <TBlock extends Block>(blockHistory: BlockHistory<TBlock>): boolean => {
	return blockHistory.isEmpty();
}

const isOlderThanOldestBlock = <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, newBlock: TBlock): boolean => {
	return parseHexInt(blockHistory.first().number) > parseHexInt(newBlock.number);
}

const isAlreadyInHistory = <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, newBlock: TBlock): boolean => {
	// `block!` is required until the next version of `immutable` is published to NPM (current version 3.8.1) which improves the type definitions
	return blockHistory.some(block => block!.hash === newBlock.hash);
}

const isNewHeadBlock = <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, newBlock: TBlock): boolean => {
	return blockHistory.last().hash === newBlock.parentHash;
}

const parentHashIsInHistory = <TBlock extends Block>(blockHistory: BlockHistory<TBlock>, newBlock: TBlock): boolean => {
	// `block!` is required until the next version of `immutable` is published to NPM (current version 3.8.1) which improves the type definitions
	return blockHistory.some(block => block!.hash === newBlock.parentHash);
}
