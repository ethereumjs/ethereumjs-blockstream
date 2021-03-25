// @file filter
// @exports {Filter,FilterOptions}

export interface Filter {
	readonly address?: string;
	readonly topics?: Array<string | Array<string>>;
}

export interface FilterOptions extends Filter {
	readonly blockHash: string;
}
