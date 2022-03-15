import * as fs from 'fs';
import * as inquirer from "inquirer";
import { getParameters } from "./parameters.js";

const Parameters = getParameters();

import { promisify } from "util";
const writeFileAsync = promisify(fs.writeFile);
const fileExists = promisify(fs.exists);

export const checkConfig = async () => {
	const exists = await fileExists(Parameters.configFileName);

	if (exists) {
		return;
	}

	const config = await inquirer.prompt(Parameters.configQuestions);
	await writeFileAsync("./snapshot.config.json", JSON.stringify(config, null, 2));
	console.info("Configuration file was successfully created. Please run the program again.");
	process.exit();
};

export const getConfig = () => {
	try {
		const contents = fs.readFileSync(Parameters.configFileName);
		return JSON.parse(contents);
	} catch (e) {
		console.error("Configuration file was not found.");
	}
};
