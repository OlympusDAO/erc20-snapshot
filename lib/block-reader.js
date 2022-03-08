"use strict";

const fs = require("fs");
const path = require("path");

const { promisify } = require("util");

const Parameters = require("../parameters").get();

const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

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

module.exports.getEvents = async symbol => {
  const directory = Parameters.eventsDownloadFolder.replace(/{token}/g, symbol);
  // Get the names of all the block files with events in the tx directory
  var files = await readdirAsync(directory);
  // Sort file names to make sure chronological order is kept
  files.sort((a, b) => {
    return parseInt(a.split(".")[0]) - parseInt(b.split(".")[0]);
  });
  let events = [];

  console.log("Parsing files.");

  // Load all the events from the block files into `events`
  for await (const file of files) {
    console.log("Parsing ", file);

    const contents = await readFileAsync(path.join(directory, file));
    const parsed = JSON.parse(contents.toString());
    // Select only the event fields we are interested in to save memory
    events = events.concat(getMinimal(parsed));
  }

  return events;
};
