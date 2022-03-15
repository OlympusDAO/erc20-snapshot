import * as fs from 'fs';
import { getConfig } from "./config.js";
import { getParameters } from "./parameters.js";
import { promisify } from "util";
import { parseFile, maxBlockFile } from './file-helper.js';

const Config = getConfig();
const Parameters = getParameters();

const readdirAsync = promisify(fs.readdir);
const pathExistsAsync = promisify(fs.exists);

export const getLoadMode = async symbol => {

  // Check if there are already any events loaded for this symbol in the folder ./tx
  const eventsFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol)
  const anyEventsLoaded = await pathExistsAsync(eventsFolder);

  let 
    scanFrom, // the index of the block we are starting the search at
    lastLoadedBlock = null; // the index of the last block we have already loaded into ./tx

  // If some events have already been loaded, we start loading starting at the last loaded one
  if (anyEventsLoaded) {
    const eventsFiles = await readdirAsync(eventsFolder);
    lastLoadedBlock = await maxBlockFile(eventsFiles);
    console.log(`Found ./tx events folder for ${symbol}. Folder contains`, eventsFiles.length, "files. Last loaded block:", lastLoadedBlock);
    scanFrom = lastLoadedBlock + 1;
  }
  // Else we start loading at the block number defined in the config file (if that's defined. if not, we start from 0).
  else {
    console.log(`Didn't find ./tx events folder for ${symbol}.`);
    if (!Config.fromBlock) console.log("Block number \"fromBlock\" not defined in config file");
    const fromBlock = Config.fromBlock ? Config.fromBlock : 0; 
    scanFrom = fromBlock;
  }

  // Check if there's a file in .cache/ for previous hasura write
  const anyPreviousHasuraWrite = await pathExistsAsync(Parameters.previousHasuraWrite);
  // If no Hasura writes have been made yet, we will do an initial load
	if (!anyPreviousHasuraWrite) {
    console.log(`Previous Hasura write file ${Parameters.previousHasuraWrite} doesn't exist yet.`);
    console.log("\n### INITIAL LOAD ###: Start scanning blocks starting at", scanFrom, 
      "; then, insert into Hasura the addresses that made transactions from block", scanFrom, "to", Config.toBlock, "\n");
    return { mode: "INITIAL-LOAD", scanFrom, lastLoadedBlock };

  // If an Hasura write has been made before, this run will be an incremental load
  } else {

    // Throw error case there are no events file in ./tx. It's not supposed to happen that we're running an incremental load
    // while having no previous events files
    if (lastLoadedBlock === null) {
      throw Error(`ERROR: Something's wrong! An INCREMENTAL LOAD is being ran, but there are no events files in ./tx for ${symbol}`)
    }

    const previousHasuraWrite = await parseFile(Parameters.previousHasuraWrite);
    console.log(`Found previous Hasura write file ${Parameters.previousHasuraWrite}. File contents:`);
    console.log(previousHasuraWrite);

    // If in `previous-hasura-write.json` the field outcome.lastScannedBlock is not greater that 
    // the number in the highest loaded block in ./tx folder, we send a warning. Note that this won't make the incremental load stop.
    // The incremental load will be done starting at the block where the last successful Hasura write ended (since the file 
    // `previous-hasura-write.json` is only written case the Hasura write was successful).
    if (previousHasuraWrite.outcome.lastScannedBlock < lastLoadedBlock) {
      console.log("WARNING: previousHasuraWrite.outcome.lastScannedBlock is smaller than last loaded block in the events folder.",
      "This likely means that the last write to Hasura was unsuccessful.");
    }

    // Addresses that made transactions after block `newAddressesFrom` are the only ones
    // updated/inserted in the incremental load
    const newAddressesFrom = previousHasuraWrite.outcome.lastScannedBlock + 1 
    
    console.log("\n### INCREMENTAL LOAD ###: Start scanning blocks from", scanFrom, 
      "; then, insert/update into Hasura the addresses that made transactions from block", newAddressesFrom, "to", Config.toBlock, "\n");
    return { mode: "INCREMENTAL-LOAD", scanFrom, lastLoadedBlock, newAddressesFrom };
  }
};
