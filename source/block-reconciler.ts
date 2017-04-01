import { Block } from "./models/block";
import { BlockHistory } from "./models/block-history";
import { List as ImmutableList } from "immutable";

export const reconcileBlockHistory = async (
	getBlockByHash: (hash: string) => Promise<Block|null>,
	blockHistory: BlockHistory|Promise<BlockHistory>,
	newBlock: Block,
	onBlockAdded: (block: Block) => Promise<void>,
	onBlockRemoved: (block: Block) => Promise<void>,
	blockRetention: number = 100,
): Promise<BlockHistory> => {
	blockHistory = await blockHistory;
	if (isFirstBlock(blockHistory))
		return await addNewHeadBlock(blockHistory, newBlock, onBlockAdded, blockRetention);

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

const rollback = async (blockHistory: BlockHistory, onBlockRemoved: (block: Block) => Promise<void>): Promise<BlockHistory> => {
	while (!blockHistory.isEmpty()) {
		// CONSIDER: if this throws an exception, removals may have been announced that are actually still in history since throwing will result in no history update. we can't catch errors here because there isn't a clear way to recover from them, the failure may be a downstream system telling us that the block removal isn't possible because they are in a bad state. we could try re-announcing the successfully added blocks, but there would still be a problem with the failed block (should it be re-announced?) and the addition announcements may also fail
		blockHistory = await removeHeadBlock(blockHistory, onBlockRemoved);
	}
	return blockHistory;
}

const backfill = async (getBlockByHash: (hash: string) => Promise<Block|null>, blockHistory: BlockHistory, newBlock: Block, onBlockAdded: (block: Block) => Promise<void>, onBlockRemoved: (block: Block) => Promise<void>, blockRetention: number) => {
	if (newBlock.parentHash === "0x0000000000000000000000000000000000000000000000000000000000000000")
		return rollback(blockHistory, onBlockRemoved);
	const parentBlock = await getBlockByHash(newBlock.parentHash);
	if (parentBlock === null) throw new Error("Failed to fetch parent block.");
	if (parseInt(parentBlock.number, 16) + blockRetention < parseInt(blockHistory.last().number, 16))
		return rollback(blockHistory, onBlockRemoved);
	blockHistory = await reconcileBlockHistory(getBlockByHash, blockHistory, parentBlock, onBlockAdded, onBlockRemoved, blockRetention);
	return await reconcileBlockHistory(getBlockByHash, blockHistory, newBlock, onBlockAdded, onBlockRemoved, blockRetention);
}

const addNewHeadBlock = async (blockHistory: BlockHistory, newBlock: Block, onBlockAdded: (block: Block) => Promise<void>, blockRetention: number): Promise<BlockHistory> => {
	// this is here as a final sanity check, in case we somehow got into an unexpected state, there are no known (and should never be) ways to reach this exception
	if (!blockHistory.isEmpty() && blockHistory.last().hash !== newBlock.parentHash) throw new Error("New head block's parent isn't our current head.");
	// CONSIDER: the user getting this notification won't have any visibility into the updated block history yet. should we announce new blocks in a `setTimeout`? should we provide block history with new logs? an announcement failure will result in unwinding the stack and returning the original blockHistory, if we are in the process of backfilling we may have already announced previous blocks that won't actually end up in history (they won't get removed if a re-org occurs and may be re-announced). we can't catch errors thrown by the callback be cause it may be trying to signal to use that the block has become invalid and is un-processable
	await onBlockAdded(newBlock);
	blockHistory = blockHistory.push(newBlock);
	return blockHistory.takeLast(blockRetention).toList();
}

const removeHeadBlock = async (blockHistory: BlockHistory, onBlockRemoved: (block: Block) => Promise<void>): Promise<BlockHistory> => {
	let removedBlock = blockHistory.last();
	blockHistory = blockHistory.pop();
	await onBlockRemoved(removedBlock);
	return blockHistory;
}

const isFirstBlock = (blockHistory: BlockHistory, ): boolean => {
	return blockHistory.isEmpty();
}

const isAlreadyInHistory = (blockHistory: BlockHistory, newBlock: Block): boolean => {
	// `block!` is required until the next version of `immutable` is published to NPM (current version 3.8.1) which improves the type definitions
	return blockHistory.some(block => block!.hash === newBlock.hash);
}

const isNewHeadBlock = (blockHistory: BlockHistory, newBlock: Block): boolean => {
	return blockHistory.last().hash === newBlock.parentHash;
}

const parentHashIsInHistory = (blockHistory: BlockHistory, newBlock: Block): boolean => {
	// `block!` is required until the next version of `immutable` is published to NPM (current version 3.8.1) which improves the type definitions
	return blockHistory.some(block => block!.hash === newBlock.parentHash);
}
