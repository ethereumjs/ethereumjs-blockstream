import { Block, Transaction, Log, FilterOptions } from '../source/index'

export function delay(milliseconds: number): Promise<void> {
	return new Promise<void>((resolve, reject) => setTimeout(resolve, milliseconds))
}

export function getBlockByHashFactory(blocks: Block[] = []) {
	const blockMapping = blocks.reduce((mapping, block) => mapping.set(block.hash, block), new Map<string, Block>())
	return async (hash: string): Promise<Block | null> => {
		await delay(0)
		const mappedBlock = blockMapping.get(hash)
		if (mappedBlock !== undefined) {
			return mappedBlock
		} else {
			const blockNumber = parseInt(hash.substr(-4), 16)
			const fork = hash.substr(-8, 4)
			return new MockBlock(blockNumber, fork, fork)
		}
	}
}

export function getLogsFactory(logsPerFilter: number, fork: string = 'AAAA') {
	return async (filterOptions: FilterOptions): Promise<Log[]> => {
		await delay(0)
		if (!filterOptions) throw new Error('filter options are required')
		const logs = []
		let logIndex = 0
		for (let i = 0; i < logsPerFilter; ++i) {
			const blockNumber = parseInt(filterOptions.toBlock!, 16)
			logs.push(new MockLog(blockNumber, logIndex++, fork))
		}
		return logs
	}
}

export class MockBlock implements Block {
	readonly hash: string
	readonly parentHash: string
	readonly number: string
	readonly nonce: string = ''
	readonly sha3Uncles: string = ''
	readonly logsBloom: string = 'string'
	readonly transactionRoot: string = 'string'
	readonly stateRoot: string = 'string'
	readonly receiptsRoot: string = 'string'
	readonly miner: string = 'string'
	readonly difficulty: string = 'string'
	readonly totalDifficulty: string = 'string'
	readonly size: string = 'string'
	readonly gasLimit: string = 'string'
	readonly gasUsed: string = 'string'
	readonly timestamp: string = 'string'
	readonly transactions: string[] | Transaction[] = []
	readonly uncles: string[] = []

	constructor(number: number, fork: string = 'AAAA', parentFork?: string) {
		if (!parentFork) parentFork = fork
		const numberAsHex = number.toString(16)
		const parentNumberAsHex = (number - 1).toString(16)
		this.hash = `0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0c${fork}${`0000${numberAsHex}`.substring(
			numberAsHex.length
		)}`
		this.parentHash = `0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0c${parentFork}${`0000${parentNumberAsHex}`.substring(
			parentNumberAsHex.length
		)}`
		this.number = `0x${numberAsHex}`
	}
}

export class MockLog implements Log {
	readonly logIndex: string
	readonly blockNumber: string
	readonly blockHash: string
	readonly transactionHash: string = '0xbaadf00dbaadf00dbaadf00dbaadf00dbaadf00dbaadf00dbaadf00dbaadf00d'
	readonly transactionIndex: string = '0x0'
	readonly address: string = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
	readonly data: string = '0x0000000000000000000000000000000000000000000000000000000000000000'
	readonly topics: string[] = []

	constructor(blockNumber: number, logIndex: number = 0x0, fork: string = 'AAAA') {
		const blockNumberAsHex = blockNumber.toString(16)
		this.blockNumber = '0x' + blockNumberAsHex
		this.blockHash = `0xbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0cbl0c${fork}${(
			'0000' + blockNumberAsHex
		).substring(blockNumberAsHex.length)}`
		this.logIndex = `0x${logIndex.toString(16)}`
		this.transactionIndex = this.logIndex
	}
}
