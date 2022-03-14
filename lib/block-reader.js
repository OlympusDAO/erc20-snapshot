// `graceful-fs` instead of just `fs` to handle problem that happens when too many files are open in parallel
import fs from "graceful-fs";
import { promisify } from "util";
import { join } from "path";
import { getParameters } from "../parameters.js";
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
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
	var nFiles = fileNames.length;
  if (batchEndIdx > nFiles) batchEndIdx = nFiles;
  var newAddresses = new Set();

	// `graceful-fs` increases the number of files that are possible to open without
	// throwing EMFILE, but was still getting EMFILE when trying to open >100k files for gOHM,
	// so did batching as well
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
        if (loadMode.mode == "INCREMENTAL-LOAD" && blockNumber >= loadMode.scanFrom) {
          console.log("NEW BLOCK FILE", blockNumber)
          for (const event of minimalParsed) {
            newAddresses.add(event.from);
            newAddresses.add(event.to);
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

export const parseEvents = async (symbol, loadMode) => {
	const directory = Parameters.eventsDownloadFolder.replace(/{token}/g, symbol);
	// Get the names of all the block files with events in the tx directory
	var fileNames = await readdirAsync(directory);

  console.log({fileNames});

	console.log("Parsing files...");
	// Load all the events from the block files into `events`
	const {events, newAddresses} = await readEventFiles(directory, fileNames, loadMode);

	return {events, newAddresses};
};
