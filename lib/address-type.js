import enumerable from "linq";
import Web3 from "web3";
import { getConfig } from "./config.js";
import { getParameters } from "./parameters.js";
import { parseFile, writeFile } from "./file-helper.js";

const Config = getConfig();
const Parameters = getParameters();

const web3 = new Web3(new Web3.providers.HttpProvider((Config || {}).provider || "http://localhost:8545"));

const BATCH_SIZE = 100;

const findTypeFromCache = (cache, address) => {
  if (cache && cache.length) {
    for (const entry of cache) {
      if (entry.address === address) {
        return entry.type;
      }
    }
  }

  return null;
};

export const addType = async balances => {

  console.log("Determining address types.");
  let cache = await parseFile(Parameters.knownTypes);

  var nContracts = 0;
  var batchStartIdx = 0;
  var batchEndIdx = BATCH_SIZE;
  var nBalances = balances.length;
  if (batchEndIdx > nBalances) batchEndIdx = nBalances;

  while (batchEndIdx <= nBalances) {
    // Get a balances batch (this is shallow copy so referencing objects inside this batch
    // changes the original objects)
    var balancesBatch = balances.slice(batchStartIdx, batchEndIdx);
    await Promise.all(
      balancesBatch.map(async balance => {
        let type = findTypeFromCache(cache, balance.address);
        if (!type) {
          type = "wallet";

          const code = await web3.eth.getCode(balance.address);

          if (code != "0x") {
            type = "contract";
            console.log("✓", balance.address, "is a contract.");
          }
        }
        if (type === "contract") nContracts++;
        balance.address_type = type;
        return balance;
      })
    );

    console.log(`${batchEndIdx}/${nBalances}`);
    // Finished last batch; break
    if (batchEndIdx === nBalances) break;

    batchStartIdx = batchEndIdx;
    batchEndIdx = batchStartIdx + BATCH_SIZE;

    if (batchEndIdx > nBalances) batchEndIdx = nBalances;
  };

  console.log(`Found ${nContracts} contracts out of ${nBalances} addresses.`);

  const knownTypes = enumerable
    .from(balances)
    .select(x => {
      return { address: x.address, address_type: x.address_type };
    })
    .toArray();

  await writeFile(Parameters.knownTypes, knownTypes);

  return enumerable
    .from(balances)
    .orderBy(x => x.type)
    .thenByDescending(x => parseFloat(x.balance))
    .toArray();
};
