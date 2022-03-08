"use strict";

const Web3 = require("web3");

const BlockByBlock = require("./block-by-block");
const BlockReader = require("./block-reader");
const Config = require("../config").getConfig();
const Contract = require("../contract").getContract();
const FileHelper = require("../file-helper");
const LastScannedBlock = require("./last-scanned-block");
const Parameters = require("../parameters").get();

const { promisify } = require("util");

const sleep = promisify(setTimeout);

const web3 = new Web3(new Web3.providers.HttpProvider((Config || {}).provider || "http://localhost:8545"));

const groupBy = (objectArray, property) => {
  return objectArray.reduce((acc, obj) => {
    var key = obj[property];
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(obj);
    return acc;
  }, {});
};

const tryGetEvents = async (start, end, symbol) => {
  try {
    // We only get past events for the specified contract. This makes the data fetching much faster than if we had
    // to fetch all the data from every single block and filter afterwards for contract address
    const pastEvents = await Contract.getPastEvents("Transfer", { fromBlock: start, toBlock: end });

    if (pastEvents.length) {
      console.info("Successfully imported ", pastEvents.length, " events");
    }

    // Group events belonging to the same block number,
    // the format of `group` is {blockNumber1: [events1], blockNumber2: [events2], ...}
    const group = groupBy(pastEvents, "blockNumber");

    // Iterate through all the blocks in current batch
    for (let key in group) {
      if (group.hasOwnProperty(key)) {
        const blockNumber = key;
        const data = group[key];

        const file = Parameters.eventsDownloadFilePath.replace(/{token}/g, symbol).replace(/{blockNumber}/g, blockNumber);

        // Store all the events from the same block into a single file with name corresponding to block number
        FileHelper.writeFile(file, data);
      }
    }
  } catch (e) {
    console.log("Could not get events due to an error. Now checking block by block.");
    console.log("Error message:", e.message);
    // If block batch fetching fails, we switch to fetching block-by-block
    await BlockByBlock.tryBlockByBlock(Contract, start, end, symbol);
  }
};

module.exports.get = async () => {
  const name = await Contract.methods.name().call();
  const symbol = await Contract.methods.symbol().call();
  const decimals = await Contract.methods.decimals().call();
  // TODO: if `Config.fromBlock` "earliest" or undefined, consider fromBlock
  // as the first block where there is a transaction for the target contract address
  var fromBlock = parseInt(Config.fromBlock) || 0;
  var toBlock;
  const blocksPerBatch = parseInt(Config.blocksPerBatch) || 0;
  const delay = parseInt(Config.delay) || 0;

  // if `Config.toBlock` undefined or "latest", the last block is current block height
  if (!Config.toBlock || Config.toBlock === "latest") {
    toBlock = await web3.eth.getBlockNumber();
  // Else it's the block height defined in `Config.toBlock`
  } else {
    toBlock = parseInt(Config.toBlock);
  }

  // If blocks have already been fetched for this contract, we start fetching from
  // the last fetched block instead of starting all over from the beginning
  const lastScannedBlock = await LastScannedBlock.get(symbol);

  if (lastScannedBlock.status == "balances" || lastScannedBlock.status == "events") {
    console.log("Resuming scanning from the last scanned block #", lastScannedBlock.blockNumber);
    fromBlock = lastScannedBlock.blockNumber + 1;
  }

  console.log("Scanning for events from block", fromBlock, "to block", toBlock);

  // Fetch the events, batch by batch
  let start = fromBlock;
  let end = fromBlock + blocksPerBatch;
  let i = 0;

  while (end <= toBlock) {
    i++;

    // Sleep time in between batch fetches
    if (delay) {
      await sleep(delay);
    }

    console.log("Batch", i + 1, " From", start, "to", end);

    await tryGetEvents(start, end, symbol);

    // Finished last batch; break
    if (end === toBlock) break;

    // Next batch starts at the end of previous batch + 1
    start = end + 1;
    end = start + blocksPerBatch;

    // Do last batch
    if (end > toBlock) end = toBlock;
  }

  console.log("Done scanning events!");
  // Load all the events from the block files into memory
  const events = await BlockReader.getEvents(symbol);

  const data = {
    name,
    symbol,
    decimals,
    fromBlock,
    toBlock,
    events: events,
    lastScannedBlock
  };

  return data;
};
