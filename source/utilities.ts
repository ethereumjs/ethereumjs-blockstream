export const parseHexInt = (value: string) => {
	const result = Number.parseInt(value, 16);
	if (!Number.isFinite(result)) throw new Error(`${value} is not a hex encoded integer, parsing returned ${result}.`);
	return result;
}
