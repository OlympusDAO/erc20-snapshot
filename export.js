import path from "path";
import {ensureDirectory, writeFile, deleteFile} from "./file-helper.js";
import { getParameters } from "./parameters.js";
import { addType } from "./wallet-type.js";
import csvWriter from "csv-writer";
import { getConfig } from "./config.js";

const Parameters = getParameters();
const format = getConfig().format();
const objectToCsv = csvWriter.createObjectCsvWriter;

export const dumpBalancesFile = async (eventData, balances) => {
	const withType = await addType(balances);

	const writeCsv = () => {
		const file = Parameters.outputFileName.replace(/{token}/g, `${eventData.symbol}-${eventData.toBlock}.csv`);
		ensureDirectory(path.dirname(file));

		const writer = objectToCsv({
			path: file,
			header: [{ id: "wallet", title: "address" }, { id: "balance", title: `${eventData.symbol}_balance` }, { id: "type", title: "address_type" }]
		});

		console.log("Exporting CSV");
		writer.writeRecords(withType).then(() => console.log("CSV export done!"));
	};

	if (format.toLowerCase() === "csv") {
		writeCsv();
	} else if (format.toLowerCase() === "json") {
		console.log("Exporting JSON");
		await writeFile(Parameters.outputFileName.replace(/{token}/g, `${eventData.symbol}-${eventData.toBlock}.json`), withType);
		console.log("JSON export done!");
	}

	// Delete previous balances file if we're incremental loading
	if (eventData.loadMode.mode === "INCREMENTAL-LOAD") {
		console.log(`Deleting previous balances file ${eventData.loadMode.fileName}`);
		await deleteFile(`${Parameters.outputFileName}/../${eventData.loadMode.fileName}`);
	}
	console.log("Finished.");
};
