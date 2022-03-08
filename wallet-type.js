const enumerable = require("linq");
const Web3 = require("web3");
const Config = require("./config").getConfig();
const FileHelper = require("./file-helper");
const Parameters = require("./parameters").get();

const web3 = new Web3(new Web3.providers.HttpProvider((Config || {}).provider || "http://localhost:8545"));

const BATCH_SIZE = 20;

const findTypeFromCache = (cache, wallet) => {
  if (cache && cache.length) {
    for (const entry of cache) {
      if (entry.wallet === wallet) {
        return entry.type;
      }
    }
  }

  return null;
};

module.exports.addType = async balances => {
  if (!Config.checkIfContract) {
    return balances;
  }

  console.log("Determining address types.");
  let cache = await FileHelper.parseFile(Parameters.knownTypes);

  var nContracts = 0;
  var batchStartIdx = 0;
  var batchEndIdx = BATCH_SIZE;
  var nBalances = balances.length;

  while (batchEndIdx <= nBalances) {
    // Get a balances batch (this is shallow copy so referencing objects inside this batch
    // changes the original objects)
    var balancesBatch = balances.slice(batchStartIdx, batchEndIdx);
    await Promise.all(
      balancesBatch.map(async balance => {
        let type = findTypeFromCache(cache, balance.wallet);
        if (!type) {
          type = "wallet";

          const code = await web3.eth.getCode(balance.wallet);

          if (code != "0x") {
            nContracts++;
            type = "contract";
            console.log("✓", balance.wallet, "is a contract.");
          }
        }
        balance.type = type;
        return balance;
      })
    );

    console.log(`${batchEndIdx}/${nBalances}`);
    // Finished last batch; break
    if (batchEndIdx === nBalances) break;

    batchStartIdx = batchEndIdx;
    batchEndIdx = batchStartIdx + BATCH_SIZE;

    if (batchEndIdx > nBalances) batchEndIdx = nBalances;
  }

  console.log(`Found ${nContracts} contracts out of ${nBalances} addresses.`);

  const knownTypes = enumerable
    .from(balances)
    .select(x => {
      return { wallet: x.wallet, type: x.type };
    })
    .toArray();

  await FileHelper.writeFile(Parameters.knownTypes, knownTypes);

  return enumerable
    .from(balances)
    .orderBy(x => x.type)
    .thenByDescending(x => parseFloat(x.balance))
    .toArray();
};
