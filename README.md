# ethereumjs-blockstream

[![Build Status](https://travis-ci.org/ethereumjs/ethereumjs-blockstream.svg?branch=master)](https://travis-ci.org/ethereumjs/ethereumjs-blockstream) [![Coverage Status](https://coveralls.io/repos/ethereumjs/ethereumjs-blockstream/badge.svg?branch=master&service=github)](https://coveralls.io/github/ethereumjs/ethereumjs-blockstream?branch=master) [![npm version](https://badge.fury.io/js/ethereumjs-blockstream.svg)](https://badge.fury.io/js/ethereumjs-blockstream)

A library to turn an unreliable remote source of Ethereum blocks into a reliable stream of blocks.  Handles block and log removals on chain reorganizations as well as block and log backfills on skipped blocks.

## Usage

ethereumjs-blockstream can be installed using npm:

```
npm install ethereumjs-blockstream
```

### [Instantiate](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L466)

```javascript
new BlockAndLogStreamer(getBlockByHashFunction, getLogsFunction, { blockRetention: 5 });
```

### [Subscribe](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L467-L470)

```javascript
blockAndLogStreamer.subscribeToOnLogAdded(onLogAddedCallback);
```

### [Reconcile New Blocks](https://github.com/ethereumjs/ethereumjs-blockstream/blob/master/tests/index.ts#L512-L514)

```javascript
blockAndLogStreamer.reconcileNewBlock(blockFromGetLatest);
```

## Build

```
npm run build
```
To build using Docker:

```
docker build -t blockstream .
```

## Test

```
npm run test
```

To run tests using Docker:

```
docker run blockstream
```
