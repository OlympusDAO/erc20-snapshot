import * as fs from 'fs';
import enumerable from "linq";
import { getConfig } from "../config.js";
import { getParameters } from "../parameters.js";
import { promisify } from "util";
import { parseFile } from '../file-helper.js';

const Config = getConfig();
const Parameters = getParameters();

const readdirAsync = promisify(fs.readdir);
const pathExistsAsync = promisify(fs.exists);

export const getLoadMode = async symbol => {

  const eventsFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol)
  const anyEventsLoaded = !!(await pathExistsAsync(eventsFolder));
  var eventsFiles, lastLoadedBlock;
  if (anyEventsLoaded) {
    eventsFiles = await readdirAsync(eventsFolder);
    lastLoadedBlock = enumerable
		.from(eventsFiles)
		.select(x => {
			return parseInt(x.replace(".json", "")) || 0;
		})
		.max(x => x);
  }

  // If no Hasura writes have been made yet, we will do an initial load
	if (!(await pathExistsAsync(Parameters.previousHasuraWrite))) {
    console.log(`Previous run file ${Parameters.previousHasuraWrite} doesn't exist yet.`);
    // If some events have already been loaded, we start loading starting at the last scanned one
    if (anyEventsLoaded) {
      console.log(`Found events folder ${eventsFolder}. Folder contains`, eventsFiles.length, "files. Last loaded block:", lastLoadedBlock);
      console.log("### LOAD MODE: Start scanning blocks from", lastLoadedBlock, "; then do INITIAL LOAD with ALL blocks.");
      return { mode: "INITIAL-LOAD", scanFrom: lastLoadedBlock + 1 };
    }
    // Else we start loading at the block number defined in the config file (if that's defined. if not, we start from 0).
    else {
      console.log(`Didn't find events folder for ${symbol}.`);
      if (!Config.fromBlock) console.log("Block number \"fromBlock\" not defined in config file");
      const fromBlock = Config.fromBlock ? Config.fromBlock : 0; 
      console.log("### LOAD MODE: Start scanning blocks from", fromBlock, "; then do INITIAL LOAD with ALL blocks.");
      return { mode: "INITIAL-LOAD", scanFrom: fromBlock };
    }
  // If an Hasura write has been made before, this run will be an incremental load
  } else {
    const previousHasuraWrite = await parseFile(Parameters.previousHasuraWrite);
    console.log(`Found previous run file ${Parameters.previousHasuraWrite}. File contents:`);
    console.log(previousHasuraWrite);

    // Make sure that in the file `previous-run.json`, the field outcome.lastScannedBlock is greater that 
    // the number in the highest loaded block in the events folder
    if (previousHasuraWrite.outcome.lastScannedBlock < lastLoadedBlock) {
      throw Error("Something's wrong!! previousHasuraWrite.outcome.lastScannedBlock is smaller than last loaded block in the events folder.");
    }
    console.log("### LOAD MODE: Start scanning blocks from", previousHasuraWrite.outcome.lastScannedBlock, "; then do INCREMENTAL LOAD with NEW blocks.");
    return { mode: "INCREMENTAL-LOAD", scanFrom: previousHasuraWrite.outcome.lastScannedBlock + 1 };
  }
};
