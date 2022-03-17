import { promisify } from "util";
import { tryBlockByBlock } from "./block-by-block.js";
import { readBlockFiles } from "./events-reader.js";
import { getConfig } from "./config.js";
import { getParameters } from "./parameters.js";
import { getContract } from "./contract.js";
import { writeFile } from "./file-helper.js";
import { getLoadMode } from "./load-mode.js";

const Config = getConfig();
const Parameters = getParameters();
const Contract = getContract();

const sleep = promisify(setTimeout);

const groupBy = (objectArray, property) => {
	return objectArray.reduce((acc, obj) => {
		let key = obj[property];
		if (!acc[key]) {
			acc[key] = [];
		}
		acc[key].push(obj);
		return acc;
	}, {});
};

const tryGetEvents = async (start, end, symbol) => {
	try {
		// We only get past events for the specified contract. This makes the data fetching much faster than if we had
		// to fetch all the data from every single block and filter afterwards for contract address
		const pastEvents = await Contract.getPastEvents("Transfer", { fromBlock: start, toBlock: end });

    //console.log({ pastEvents: JSON.stringify(pastEvents, null, 2) });
		if (pastEvents.length) {
			console.info("Successfully imported ", pastEvents.length, " events");
		}

		// Group events belonging to the same block number,
		// the format of `group` is {blockNumber1: [events1], blockNumber2: [events2], ...}
		const group = groupBy(pastEvents, "blockNumber");

		// Iterate through all the blocks in current batch
		for (let key in group) {
			if (Object.prototype.hasOwnProperty.call(group, key)) {
				const blockNumber = key;
				const data = group[key];

				const file = Parameters.eventsDownloadFilePath.replace(/{token}/g, symbol).replace(/{blockNumber}/g, blockNumber);

				// Store all the events from the same block into a single file with name corresponding to block number
				await writeFile(file, data);
			}
		}
	} catch (e) {
		console.log("Could not get events due to an error. Now checking block by block.");
		console.log("Error message:", e.message);
		// If block batch fetching fails, we switch to fetching block-by-block
		await tryBlockByBlock(Contract, start, end, symbol);
	}
};

export const getEvents = async () => {
	const name = await Contract.methods.name().call();
	const symbol = await Contract.methods.symbol().call();
	const decimals = await Contract.methods.decimals().call();
	const blocksPerBatch = parseInt(Config.blocksPerBatch) || 0;
	const delay = parseInt(Config.delay) || 0;

	// If blocks have already been loaded for this contract, we start scanning from
	// the last loaded block instead of starting all over from the beginning
	const loadMode = await getLoadMode(symbol);
  console.log({ loadMode });
  const fromBlock = loadMode.scanFrom;
  const toBlock = loadMode.scanTo;

  if (fromBlock !== null) {

    // Scan the blocks, batch by batch
    let start = fromBlock;
    let end = fromBlock + blocksPerBatch;
    if (end > toBlock) end = toBlock;
    let i = 0;

    while (end <= toBlock) {

      // Sleep time in between batch fetches
      if (delay) {
        await sleep(delay);
      }

      console.log("Scan Batch", i + 1, "- From block", start, "to", end);

      await tryGetEvents(start, end, symbol);

      // Finished last batch; break
      if (end === toBlock) break;

      // Next batch starts at the end of previous batch + 1
      start = end + 1;
      end = start + blocksPerBatch;

      // Do last batch
      if (end > toBlock) end = toBlock;
      i++;
    };

    console.log("Done scanning events!");
  }
  // If we already have loaded all the events needed, `fromBlock` is null and
  // we skip the scanning
  else {
    console.log(`No need to scan events as the last loaded block number in ./tx for ${symbol} (`, loadMode.lastLoadedBlock, 
    ") is >= than the value defined in Config.toBlock(", Config.toBlock, ")")
  }
	// Load all the events from the block files into memory. If incremental mode
  // also store all the observed addresses in the newly scanned blocks
	const { events, newAddresses } = await readBlockFiles(symbol, loadMode);

	const data = {
		name,
		symbol,
		decimals,
		toBlock,
		events,
    newAddresses,
		loadMode
	};

	return data;
};
