"use strict";

const fs = require("fs");

const enumerable = require("linq");

const Parameters = require("../parameters").get();
const Config = require("../config").getConfig();

const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const pathExistsAsync = promisify(fs.exists);

module.exports.get = async symbol => {
  const txFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol);

  // If folder with this contract's symbol doesn't exist in tx/{symbol}, stop right away and download
  // events from scratch
  if (!(await pathExistsAsync(txFolder))) {
    console.log(`Events folder ./tx/${symbol}/ doesn't exist yet`);
    if (Config.fromBlock) {
      console.log(`Starting events scanning from block number "fromBlock" defined in config file:`, Config.fromBlock);
    } else {
      console.log(`Block number "fromBlock" not defined in config file. Starting events scanning from block`, 0);
    }
    return 0;
  }

  // If we find a balances file for this symbol, we get the last scanned block number
  // from the number in the balances file. Balance file name pattern is ${symbol}-${lastBlockNumber}
  // Note: this block number can be higher than the number of the latest block downloaded in tx/{symbol}/
  // because we only create a block file there case there were events for the ERC20 contract address we're targeting
  const balancesFiles = await readdirAsync(`${Parameters.outputFileName}/../`);
  for (const fileName of balancesFiles) {
    if (fileName.startsWith(symbol)) {
      const lastScannedBlock = parseInt(fileName.replace(".json", "").replace(".csv", "").substring(symbol.length + 1));
      console.log(`Found balances file ./balances/${fileName}; getting last scanned block number from the file name (`, lastScannedBlock, ").");
      return lastScannedBlock;
    }
  }

  console.log(`Balances file for ${symbol} doesn't exist yet; getting last block number from latest downloaded block in ./tx/${symbol}/`);

  // If balances file was not found, we get the last scanned block number from the name
  // of the tx/{symbol}/ file with the highest number
  const txFiles = await readdirAsync(txFolder);

  // Return the number of the highest block file already downloaded
  return enumerable
    .from(txFiles)
    .select(x => {
      return parseInt(x.replace(".json", "")) || 0;
    })
    .max(x => x);
};
