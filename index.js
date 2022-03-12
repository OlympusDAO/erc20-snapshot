#!/usr/bin/env node

import "dotenv/config";

import { createBalances } from "./balances";
import { checkConfig, getConfig } from "./config";
import { getEvents } from "./lib/blockchain";
//const Hasura = require("./lib/hasura");
const Export = require("./export");

const start = async () => {
	// Check if config file (in snapshot.config.json by default) exists. If not, show prompt
	// questions to create it.
	await checkConfig();
	const format = getConfig().format;
	// Get all the events for the specified contract address
	// Format of `events` is [event1, event2, ...]
	const events = await getEvents();

	console.log("Calculating balances of %s (%s)...", events.name, events.symbol);
	// Calculate the current balances for all the addresses from all the events
	const balances = await createBalances(events);

	// Write data to Hasura
	//await Hasura.write(events, balances);

	// Dump balances file locally
	console.log(`Found ${balances.length} holders.`);
	console.log("Exporting balances...");
	await Export.dumpBalancesFile(events, balances, format);
};

(async () => {
	try {
		await start();
	} catch (e) {
		console.error(e);
	}
})();
