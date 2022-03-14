#!/usr/bin/env node

import "dotenv/config";

import { createBalances } from "./balances.js";
import { checkConfig } from "./config.js";
import { getEvents } from "./lib/blockchain.js";
import { hasuraWrite } from "./lib/hasura.js";
import { dumpBalancesFile } from "./export.js";
import { getConfig } from "./config.js";
import { addType } from "./wallet-type.js";

const Config = getConfig();

const start = async () => {
  const startTime = new Date();
  const startTimeStr = startTime.toUTCString();
  console.log(`Starting run at ${startTimeStr}`);
	// Check if config file (in snapshot.config.json by default) exists. If not, show prompt
	// questions to create it.
	await checkConfig();
	// Get all the events for the specified contract address
	// Format of `events` is [event1, event2, ...]
	const eventData = await getEvents();

	console.log("Calculating balances of %s (%s)...", eventData.name, eventData.symbol);
	// Calculate the current balances
	var balances = await createBalances(eventData);

  console.log("Found total of", balances.length, "holders.");
  if (eventData.loadMode.mode == "INCREMENTAL-LOAD") {
    console.log("Found", eventData.newAddresses.size, "addresses to insert/update in the INCREMENTAL LOAD.");
    console.log("These addresses are:");
    console.log(Array.from(eventData.newAddresses));
  }

  if (Config.checkIfContract) {
    balances = await addType(balances);
  }

  // Write data to Hasura
  if (Config.writeToHasura) {
    await hasuraWrite(eventData, balances, startTimeStr);
  }

	// Dump balances file locally (always dumps balances of all the addresses, doesn't matter
  // if load mode is "INITIAL-LOAD" or "INCREMENTAL-LOAD")
  if (Config.writeToLocalFile) {
	  await dumpBalancesFile(eventData, balances);
  }
};

(async () => {
	try {
		await start();
	} catch (e) {
		console.error(e);
	}
})();
