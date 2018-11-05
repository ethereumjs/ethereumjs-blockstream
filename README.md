[![Build Status](https://travis-ci.org/ethereumjs/ethereumjs-blockstream.svg?branch=master)](https://travis-ci.org/ethereumjs/ethereumjs-blockstream) [![Coverage Status](https://coveralls.io/repos/ethereumjs/ethereumjs-blockstream/badge.svg?branch=master&service=github)](https://coveralls.io/github/ethereumjs/ethereumjs-blockstream?branch=master) [![npm version](https://badge.fury.io/js/ethereumjs-blockstream.svg)](https://badge.fury.io/js/ethereumjs-blockstream)

A library to turn an unreliable remote source of Ethereum blocks into a reliable stream of blocks.  Handles block and log removals on chain reorganization and block and log backfills on skipped blocks.

# Requirements for supported Ethereum node
Blockstream requires support for [EIP-234](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-234.md) in the configured Ethereum node. EIP-234 was merged Jul 28, 2018 and implemented in Geth and Parity shortly after. Versions that provide the needed functionality:
- Parity: v2.1.0+
- geth: v1.8.13+

# Usage

## Full Example
```typescript
// blockRetention is how many blocks of history to keep in memory.  it defaults to 100 if not supplied
const configuration = { blockRetention: 100 };
async function getBlockByHash(hash: string): Promise<Block|null> {
    const response = await fetch("http://localhost:8545", {
        method: "POST",
        headers: new Headers({"Content-Type": "application/json"}),
        body: { jsonrpc: "2.0", id: 1, method: "eth_getBlockByHash", params: [hash, false] }
    });
    return await response.json();
}
async function getLogs(filterOptions: FilterOptions): Promise<Log[]> {
    const response = await fetch("http://localhost:8545", {
        method: "POST",
        headers: new Headers({"Content-Type": "application/json"}),
        body: { jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [filterOptions] }
    });
    return await response.json();
}
async function getLatestBlock(): Promise<Block> {
    const response = await fetch("http://localhost:8545", {
        method: "POST",
        headers: new Headers({"Content-Type": "application/json"}),
        body: { jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }
    });
    return await response.json();
}
const blockAndLogStreamer = new BlockAndLogStreamer(getBlockByHash, getLogs, configuration);
const onBlockAddedSubscriptionToken = blockAndLogStreamer.subscribeToOnBlockAdded(block => console.log(block));
const onLogAddedSubscriptionToken = blockAndLogStreamer.subscribeToOnLogAdded(log => console.log(log));
const onBlockRemovedSubscriptionToken = blockAndLogStreamer.subscribeToOnBlockRemoved(block => console.log(block));
const onLogRemovedSubscriptionToken = blockAndLogStreamer.subscribeToOnLogRemoved(log => console.log(log));
const logFilterToken = blockAndLogStreamer.addLogFilter({address: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", topics: ["0xbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbadf00dbaadf00d"]});
blockAndLogStreamer.reconcileNewBlock(getLatestBlock());
// you will get a callback for the block and any logs that match the filter here
triggerBlockMining();
triggerBlockMining();
triggerBlockMining();
blockAndLogStreamer.reconcileNewBlock(getLatestBlock());
// you will get a callback for all blocks and logs that match the filter that have been added to the chain since the previous call to reconcileNewBlock
triggerChainReorg();
blockAndLogStreamer.reconcileNewBlock(getLatestBlock());
// you will get a callback for block/log removals that occurred due to the chain re-org, followed by block/log additions
blockAndLogStreamer.unsubscribeFromOnBlockAdded(onBlockAddedSubscriptionToken);
blockAndLogStreamer.unsubscribeFromOnBlockRemoved(onBlockRemovedSubscriptionToken);
blockAndLogStreamer.unsubscribeFromOnLogAdded(onLogAddedSubscriptionToken);
blockAndLogStreamer.unsubscribeFromOnLogRemoved(onLogRemovedSubscriptionToken);
blockAndLogStreamer.removeLogFilter(logFilterToken);
console.log(blockAndLogStreamer.getLatestReconciledBlock());
```

## Signatures
Note: if you have a TypeScript aware editor this will all be available in the tooltip
* [Filter/FilterOptions](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/source/models/filters.ts#L1-L10) - More details at [Parity JSON-RPC Wiki](https://wiki.parity.io/JSONRPC-eth-module#eth_newfilter)
* [Block](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/source/models/block.ts#L3-L22) - More details at [Parity JSON-RPC Wiki](https://wiki.parity.io/JSONRPC-eth-module#eth_getblockbyhash)
* [Log](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/source/models/log.ts#L1-L10) - More details at [Parity JSON-RPC Wiki](https://wiki.parity.io/JSONRPC-eth-module#eth_getfilterchanges)

# Development

## Build
```
docker build -t blockstream .
```
or
```
npm run build
```

## Test
```
docker run blockstream
````
or
```
npm run test
```
