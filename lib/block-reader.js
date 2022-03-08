"use strict";

// `graceful-fs` instead of just `fs` to handle problem that happens when too many files are open in parallel
const fs = require("graceful-fs");
const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
const path = require("path");
const Parameters = require("../parameters").get();

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
const readEventFiles = async (directory, fileNames) => {
  let events = [];
  await Promise.all(
    fileNames.map(async fileName => {
      const contents = await readFileAsync(path.join(directory, fileName));
      const parsed = JSON.parse(contents.toString());
      events = events.concat(getMinimal(parsed));
    })
  );
  return events;
};

module.exports.getEvents = async symbol => {
  const directory = Parameters.eventsDownloadFolder.replace(/{token}/g, symbol);
  // Get the names of all the block files with events in the tx directory
  var fileNames = await readdirAsync(directory);
  console.log("Parsing files...");
  // Load all the events from the block files into `events`
  const events = await readEventFiles(directory, fileNames);

  return events;
};
