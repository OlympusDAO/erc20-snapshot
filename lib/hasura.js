import fetch from "node-fetch";
import { writeFile } from "../file-helper.js";
import { GET_BATCH, INSERT_UPDATE_MANY } from "../graphql/snapshot.js";
import { getParameters } from "../parameters.js";

const Parameters = getParameters();

const hasuraRequest = (query, variables) => {
	return fetch(process.env.HASURA_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			"x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET
		},
		body: JSON.stringify({
			query,
			variables
		})
	});
};

const writeInitial = async (balances) => {
	// Make sure table is empty
	const getBatchReq = await hasuraRequest(GET_BATCH, { limit: 1 });
	const getBatch = await getBatchReq.json();
	if (getBatch.data.erc20_snapshot.length !== 0) {
		console.error("ERROR: The table must be empty to do INITIAL LOAD. Not writing to Hasura.");
		return { status: false };
	}

  const insertUpdateManyReq = await hasuraRequest(INSERT_UPDATE_MANY, { items: balances });
	const insertUpdateMany = await insertUpdateManyReq.json();

	// Get number of inserts and assure it's equal to length of balances
	console.log({ balances });
  console.log({ insertUpdateMany })
};

const writeIncremental = async (eventData, balances) => {
	// Make sure table is not empty
	const getBatchReq = await hasuraRequest(GET_BATCH, { limit: 1 });
	const getBatch = await getBatchReq.json();
	if (getBatch.data.erc20_snapshot.length === 0) {
		console.error("ERROR: The table must NOT be empty to do INCREMENTAL LOAD. Not writing to Hasura.");
		return { status: false };
	}
  console.log(eventData, balances)
};

export const hasuraWrite = async (eventData, balances, startTimeStr) => {
  var hasuraResult;
	if (eventData.loadMode.mode === "INITIAL-LOAD") {
		console.log("Starting Hasura INITIAL LOAD.");
		hasuraResult = await writeInitial(balances);
	}
	if (eventData.loadMode.mode === "INCREMENTAL-LOAD") {
		console.log("Starting Hasura INCREMENTAL LOAD");
		hasuraResult = await writeIncremental(eventData, balances);
	}

  if (hasuraResult.status) {
    // Save last run file
    const endTime = new Date();
    const endTimeStr = endTime.toUTCString();
    console.log(`Finished Hasura write at ${endTimeStr}`);

    // Update the .cache/previous-hasura-write.json file
    const previousHasuraWrite = {
      startTime: startTimeStr,
      endTime: endTimeStr,
      outcome: {
        mode: eventData.loadMode.mode,
        lastScannedBlock: eventData.toBlock,
        insertedRows: hasuraResult.insertedRows,
        updatedRows: hasuraResult.updatedRows,
        errors: hasuraResult.errors
      }
    }

    writeFile(Parameters.previousHasuraWrite, previousHasuraWrite);
    console.log(`Wrote ${Parameters.previousHasuraWrite} file.`)
  }
};