export interface Filter {
	readonly address?: string;
	readonly topics?: (string | string[] | null)[];
}

export interface FilterOptions extends Filter {
	readonly blockHash: string
}
