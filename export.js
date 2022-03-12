import path from "path";
import {ensureDirectory, writeFile, deleteFile} from "./file-helper.js";
import { getParameters } from "./parameters.js";
import { addType } from "./wallet-type.js";
import csvWriter from "csv-writer";

const Parameters = getParameters();
const objectToCsv = csvWriter.createObjectCsvWriter;

export const dumpBalancesFile = async (events, balances, format) => {
	const withType = await addType(balances);

	const writeCsv = () => {
		const file = Parameters.outputFileName.replace(/{token}/g, `${events.symbol}-${events.toBlock}.csv`);
		ensureDirectory(path.dirname(file));

		const writer = objectToCsv({
			path: file,
			header: [{ id: "wallet", title: "address" }, { id: "balance", title: `${events.symbol}_balance` }, { id: "type", title: "address_type" }]
		});

		console.log("Exporting CSV");
		writer.writeRecords(withType).then(() => console.log("CSV export done!"));
	};

	if (format.toLowerCase() === "csv") {
		writeCsv();
	} else if (format.toLowerCase() === "json") {
		console.log("Exporting JSON");
		await writeFile(Parameters.outputFileName.replace(/{token}/g, `${events.symbol}-${events.toBlock}.json`), withType);
		console.log("JSON export done!");
	}

	// Delete previous balances file if we're incremental loading
	if (events.loadMode.mode === "incremental") {
		console.log(`Deleting previous balances file ${events.loadMode.fileName}`);
		await deleteFile(`${Parameters.outputFileName}/../${events.loadMode.fileName}`);
	}
	console.log("Finished.");
};
