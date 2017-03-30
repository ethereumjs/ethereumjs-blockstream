[![npm version](https://badge.fury.io/js/ethereumjs-blockstream.svg)](https://badge.fury.io/js/ethereumjs-blockstream) [![Build Status](https://travis-ci.org/ethereumjs/ethereumjs-blockstream.svg?branch=master)](https://travis-ci.org/ethereumjs/ethereumjs-blockstream)

A library to turn an unreliable remote source of Ethereum blocks into a reliable stream of blocks with removals on re-orgs and backfills on skips.

# Build
`docker build -t blockstream .`
`npm run build`

# Test
`docker run blockstream`
`npm run test`
