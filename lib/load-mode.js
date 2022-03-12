import * as fs from 'fs';
import enumerable from "linq";
import { getConfig } from "../config.js";
import { getParameters } from "../parameters.js";
import { promisify } from "util";

const Config = getConfig();
const Parameters = getParameters();

const readdirAsync = promisify(fs.readdir);
const pathExistsAsync = promisify(fs.exists);

export const getLoadMode = async symbol => {
	const txFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol);

	// If folder with this contract's symbol doesn't exist in tx/{symbol}, stop right away and scan
	// events from scratch
	if (!(await pathExistsAsync(txFolder))) {
		console.log(`Events folder ./tx/${symbol}/ doesn't exist yet`);
		if (Config.fromBlock) {
			console.log("Starting events scanning from block number \"fromBlock\" defined in config file:", Config.fromBlock);
		} else {
			console.log("Block number \"fromBlock\" not defined in config file. Starting events scanning from block", 0);
		}
		return { mode: "initial-load", blockNumber: Config.fromBlock };
	}

	// If we find a balances file for this symbol, we get the last scanned block number
	// from the number in the balances file. Balance file name pattern is ${symbol}-${lastBlockNumber}
	// Note: this block number can be higher than the number of the latest block downloaded in tx/{symbol}/
	// because we only create a block file there case there were events for the ERC20 contract address we're targeting
	// --> If the balances file already exists, we assume that the initial-load to hasura has already been made, and so
	// will only update/insert into Hasura the balances of the addresses that appear in the new blocks
	const balancesFiles = await readdirAsync(`${Parameters.outputFileName}/../`);
	// There should only be one balances file per symbol (bc we're deleting the old file at the end of processing)
	// but using reverse alphabetical order sort (i.e. Z -> A) just in case we have more than one for some reason, to get
	// the latest one (i.e. highest block number in file name)
	for (const fileName of balancesFiles.sort().reverse()) {
		if (fileName.startsWith(symbol)) {
			const lastScannedBlock = parseInt(fileName.replace(".json", "").replace(".csv", "").substring(symbol.length + 1));
			console.log(`Found balances file ./balances/${fileName}; getting last scanned block number from the file name (`, lastScannedBlock, ").");
			return { mode: "incremental", fileName, blockNumber: lastScannedBlock };
		}
	}

	console.log(`Balances file for ${symbol} doesn't exist yet; getting last block number from latest downloaded block in ./tx/${symbol}/`);

	// If balances file was not found, we get the last scanned block number from the name
	// of the tx/{symbol}/ file with the highest number
	// --> If the balances file doesn't already exist, we assume that the first load hasn't already been made,
	// and so we will insert all the addresses/balances from scratch into Hasura
	const txFiles = await readdirAsync(txFolder);

	// Return the number of the highest block file already downloaded
	const lastScannedBlock = enumerable
		.from(txFiles)
		.select(x => {
			return parseInt(x.replace(".json", "")) || 0;
		})
		.max(x => x);
	return { mode: "initial-load", blockNumber: lastScannedBlock };
};
