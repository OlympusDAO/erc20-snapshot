"use strict";

const fs = require("fs");

const enumerable = require("linq");

const Parameters = require("../parameters").get();

const { promisify } = require("util");
const readdirAsync = promisify(fs.readdir);
const folderExistsAsync = promisify(fs.exists);

module.exports.get = async symbol => {
  const downloadFolder = Parameters.eventsDownloadFolder.replace("{token}", symbol);

  // If folder with this contract's symbol doesn't exist in tx/, stop right away
  if (!(await folderExistsAsync(downloadFolder))) {
    return 0;
  }
  const files = await readdirAsync(downloadFolder);

  // Return the number of the highest block file already downloaded
  return enumerable
    .from(files)
    .select(x => {
      return parseInt(x.replace(".json", "")) || 0;
    })
    .max(x => x);
};
