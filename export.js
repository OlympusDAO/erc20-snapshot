"use strict";
const path = require("path");
const FileHelper = require("./file-helper");
const Parameters = require("./parameters").get();
const WalletType = require("./wallet-type");

const objectToCsv = require("csv-writer").createObjectCsvWriter;

module.exports.exportBalances = async (events, balances, format) => {
  const withType = await WalletType.addType(balances);

  const writeCsv = () => {
    const file = Parameters.outputFileName.replace(/{token}/g, `${events.symbol}-${events.toBlock}.csv`);
    FileHelper.ensureDirectory(path.dirname(file));

    const writer = objectToCsv({
      path: file,
      header: [{ id: "wallet", title: "Wallet" }, { id: "balance", title: "Balance" }, { id: "type", title: "Type" }]
    });

    console.log("Exporting CSV");
    writer.writeRecords(withType).then(() => console.log("CSV export done!"));
  };

  if (format.toLowerCase() === "csv") {
    writeCsv();
  } else if (format.toLowerCase() === "json") {
    console.log("Exporting JSON");
    await FileHelper.writeFile(Parameters.outputFileName.replace(/{token}/g, `${events.symbol}-${events.toBlock}.json`), withType);
    console.log("JSON export done!");
  }

  // Delete previous balances file if exists
  if (events.lastScannedBlock.status === "balances") {
    console.log(`Deleting previous balances file ${events.lastScannedBlock.fileName}`);
    await FileHelper.deleteFile(`${Parameters.outputFileName}/../${events.lastScannedBlock.fileName}`);
  }
  console.log("Finished.");
};
