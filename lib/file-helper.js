import * as fs from 'fs';
import { dirname } from "path";
import { promisify } from "util";
import enumerable from "linq";

const existsAsync = promisify(fs.exists);
const makeDirectoryAsync = promisify(fs.mkdir);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const deleteFileAsync = promisify(fs.unlink);

const ensureDirectoryExists = async directory => {
	try {
		await makeDirectoryAsync(directory, { recursive: true });
	} catch (err) {
		console.log(err);
	}
};

export const ensureDirectory = async directory => {
	ensureDirectoryExists(directory);
};

export const writeFile = async (filePath, data) => {
	await ensureDirectoryExists(dirname(filePath));
	await writeFileAsync(filePath, JSON.stringify(data, null, 2));
};

export const deleteFile = async filePath => {
	try {
		await deleteFileAsync(filePath);
	} catch (err) {
		console.log(err);
	}
};

export const parseFile = async filePath => {
	if (await existsAsync(filePath)) {
		const contents = await readFileAsync(filePath);
		return JSON.parse(contents.toString());
	}

	return null;
};

export const maxBlockFile = async eventsFiles => {
  return enumerable
  .from(eventsFiles)
  .select(x => {
    return parseInt(x.replace(".json", "")) || 0;
  })
  .max(x => x);
};
