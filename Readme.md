[![npm version](https://badge.fury.io/js/ethereumjs-blockstream.svg)](https://badge.fury.io/js/ethereumjs-blockstream) [![Build Status](https://travis-ci.org/ethereumjs/ethereumjs-blockstream.svg?branch=master)](https://travis-ci.org/ethereumjs/ethereumjs-blockstream)

A library to turn an unreliable remote source of Ethereum blocks into a reliable stream of blocks with removals on re-orgs and backfills on skips.

# Usage
[Instantiate](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L466): `new BlockAndLogStreamer(getBlockByHashFunction, getLogsFunction, { blockRetention: 5 });`
[Subscribe](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L467-L470): `blockAndLogStreamer.subscribeToOnLogAdded(onLogAddedCallback);`
[Reconcile New Blocks](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L512-L514): `blockAndLogStreamer.reconcileNewBlock(blockFromGetLatest);`

# Build
`docker build -t blockstream .`
`npm run build`

# Test
`docker run blockstream`
`npm run test`
