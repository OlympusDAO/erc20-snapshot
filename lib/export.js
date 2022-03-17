import path from "path";
import csvWriter from "csv-writer";
import {ensureDirectory, writeFile} from "./file-helper.js";
import { getParameters } from "./parameters.js";
import { getConfig } from "./config.js";

const Parameters = getParameters();
const format = getConfig().format;
const objectToCsv = csvWriter.createObjectCsvWriter;

export const dumpBalancesFile = async (eventData, balances) => {

  var fileName = Parameters.outputFileName.replace(/{token}/g, `${eventData.symbol}-${eventData.toBlock}`);
	const writeCsv = async () => {
		fileName = `${fileName}.csv`
		ensureDirectory(path.dirname(fileName));

		const writer = objectToCsv({
			path: fileName,
			header: [
        { id: "address", title: "address" },
        { id: `${eventData.symbol}_balance`, title: `${eventData.symbol}_balance` },
        { id: "address_type", title: "address_type" }
      ]
		});

		console.log(`Exporting CSV file with balances ${fileName}`);
		await writer.writeRecords(balances);
    console.log("CSV export done!");
	};

	if (format.toLowerCase() === "csv") {
		await writeCsv();
	} else if (format.toLowerCase() === "json") {
    fileName = `${fileName}.json`
		console.log(`Exporting JSON file with balances ${fileName}`);
		await writeFile(fileName, balances);
		console.log("JSON export done!");
	}
};
