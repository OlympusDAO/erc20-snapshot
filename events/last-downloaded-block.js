"use strict";

const fs = require("fs");

const enumerable = require("linq");

const Parameters = require("../parameters").get();

const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const pathExistsAsync = promisify(fs.exists);

module.exports.get = async symbol => {
  const txFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol);

  // If folder with this contract's symbol doesn't exist in tx/, stop right away and download
  // events from scratch
  if (!(await pathExistsAsync(txFolder))) {
    console.log(`Events folder for ${symbol} doesn't exist yet. Starting events download from scratch.`);
    return 0;
  }

  const balancesFiles = await readdirAsync(`${Parameters.outputFileName}/../`);

  for (const fileName of balancesFiles) {
    // If we find a balances file for this symbol, we get the last block number
    // from the number in the balances file. Balance file name pattern is ${symbol}-${lastBlockNumber}
    if (fileName.startsWith(symbol)) {
      console.log(`Found balances file ${fileName}; getting last block number from that.`);
      return fileName.replace(".json", "").replace(".csv", "").substring(symbol.length + 1);
    }
  }

  console.log(`Balances file for ${symbol} doesn't exist yet.`);

  // If balances file was not found, we get the last block number from the name
  // of the tx/ file with the highest number
  const txFiles = await readdirAsync(txFolder);

  // Return the number of the highest block file already downloaded
  return enumerable
    .from(txFiles)
    .select(x => {
      return parseInt(x.replace(".json", "")) || 0;
    })
    .max(x => x);
};
