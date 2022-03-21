// `graceful-fs` instead of just `fs` to handle problem that happens when too many files are open in parallel
import fs from "graceful-fs";
import { promisify } from "util";
import { join } from "path";
import { getParameters } from "./parameters.js";
import { getConfig } from "./config.js";
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

const Config = getConfig();
const Parameters = getParameters();

const BATCH_SIZE = 10000;

const getMinimal = pastEvents => {
	return pastEvents.map(tx => {
		return {
			transactionHash: tx.transactionHash,
			from: tx.returnValues["0"],
			to: tx.returnValues["1"],
			value: tx.returnValues["2"]
		};
	});
};

// Parallel reading
const readEventFiles = async (directory, fileNames, loadMode) => {
	let events = [];
	var batchStartIdx = 0;
	var batchEndIdx = BATCH_SIZE;
  var nFilesTotal = fileNames.length;
  // We keep only events that happened between block indexes interval [Config.fromBlock, Config.toBlock]
  fileNames = fileNames.filter(fileName => 
    parseInt(fileName.replace(".json", "")) >= Config.fromBlock && parseInt(fileName.replace(".json", "")) <= loadMode.scanTo);
	var nFiles = fileNames.length;
  console.log("Using", nFiles, "out of", nFilesTotal,
    "block files in ./tx to calculate final balances ( calculation made from block", Config.fromBlock, "to", loadMode.scanTo, ")");
  if (batchEndIdx > nFiles) batchEndIdx = nFiles;
  var newAddresses = new Set();

	// `graceful-fs` increases the number of files that are possible to open without
	// throwing EMFILE, but was still getting EMFILE when trying to open >100k files for gOHM,
	// so did batching as well
  console.log("Parsing progress:");
	while (batchEndIdx <= nFiles) {
		// Get a balances batch
		var filesBatch = fileNames.slice(batchStartIdx, batchEndIdx);
		await Promise.all(
			filesBatch.map(async fileName => {
				const contents = await readFileAsync(join(directory, fileName));
				const parsed = JSON.parse(contents.toString());
        const minimalParsed = getMinimal(parsed);
				events = events.concat(minimalParsed);
        const blockNumber = parseInt(fileName.replace(".json", ""));
        // For incremental load, store the addresses observed in the newly scanned blocks
        if (loadMode.mode == "INCREMENTAL-LOAD" && blockNumber >= loadMode.newAddressesFrom) {
          console.log("NEW BLOCK FILE", blockNumber)
          for (const event of minimalParsed) {
            if(event.from !== "0x0000000000000000000000000000000000000000") newAddresses.add(event.from);
            if(event.to !== "0x0000000000000000000000000000000000000000") newAddresses.add(event.to);
          }
        }
			})
		);
		console.log(`${batchEndIdx}/${nFiles}`);
		// Finished last batch; break
		if (batchEndIdx === nFiles) break;

		batchStartIdx = batchEndIdx;
		batchEndIdx = batchStartIdx + BATCH_SIZE;

		if (batchEndIdx > nFiles) batchEndIdx = nFiles;
	};
	return {events, newAddresses};
};

export const readBlockFiles = async (symbol, loadMode) => {
	const directory = Parameters.eventsDownloadFolder.replace(/{token}/g, symbol);
	// Get the names of all the block files with events in the tx directory
	var fileNames = await readdirAsync(directory);

	console.log("Parsing files...");
	// Load all the events from the block files into `events`
	const {events, newAddresses} = await readEventFiles(directory, fileNames, loadMode);

	return {events, newAddresses};
};
