#!/usr/bin/env node
"use strict";

const Balances = require("./balances");
const Config = require("./config");
const Events = require("./lib/blockchain");
const Export = require("./export");

const start = async () => {
  // Check if config file (in snapshot.config.json by default) exists. If not, show prompt
  // questions to create it.
  await Config.checkConfig();
  const format = Config.getConfig().format;
  // Get all the events for the specified contract address
  // Format of `events` is [event1, event2, ...]
  const events = await Events.get();

  console.log("Calculating balances of %s (%s)...", events.name, events.symbol);
  // Calculate the current balances for all the addresses from all the events
  const balances = await Balances.createBalances(events);

  console.log(`Found ${balances.length} holders.`);
  console.log("Exporting balances...");
  await Export.exportBalances(events, balances, format);
};

(async () => {
  try {
    await start();
  } catch (e) {
    console.error(e);
  }
})();
