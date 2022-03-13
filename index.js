#!/usr/bin/env node

import "dotenv/config";

import { createBalances } from "./balances.js";
import { checkConfig } from "./config.js";
import { getEvents } from "./lib/blockchain.js";
//const Hasura = require("./lib/hasura");
import { dumpBalancesFile } from "./export.js";
import { config } from "dotenv";

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
  console.log("Found", balances.length, "holders.");

	// Write data to Hasura
	//await Hasura.write(eventData, balances);

  const endTimeHasura = new Date();
  const endTimeHasuraStr = endTimeHasura.toUTCString();
  console.log(`Finished Hasura write at ${endTimeHasuraStr}`);

	// Dump balances file locally
  if (config.dumpBalancesFile) {
	  console.log("Exporting balances...");
	  await dumpBalancesFile(eventData, balances);
  }
  const endTimeFinish = new Date();
  const endTimeFinishStr = endTimeFinish.toUTCString();
  console.log(`Finished dumping file locally at ${endTimeFinishStr}`);
};

(async () => {
	try {
		await start();
	} catch (e) {
		console.error(e);
	}
})();
