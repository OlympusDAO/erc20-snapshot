import fetch from "node-fetch";
import { writeFile } from "./file-helper.js";
import { GET_BATCH, INSERT_UPDATE_MANY } from "../graphql/erc20_snapshot.js";
import { getParameters } from "./parameters.js";

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

  if (getBatch.errors) {
		return { status: false, message: `ERROR during "GET_BATCH" query: ${JSON.stringify(getBatch.errors)}` };
  }
	if (getBatch.data.erc20_snapshot.length !== 0) {
		return { status: false, message: "ERROR: The table must be empty to do INITIAL LOAD. Not writing to Hasura." };
	}

  const insertUpdateManyReq = await hasuraRequest(INSERT_UPDATE_MANY, { items: balances });
	const insertUpdateMany = await insertUpdateManyReq.json();

  if (insertUpdateMany.errors) {
		return { status: false, message: `ERROR during "INSERT_UPDATE_MANY" mutation: ${JSON.stringify(insertUpdateMany.errors)}` };
  }

	// Get number of inserts and assure it's equal to length of balances. Something's wrong if those numbers don't match
  const nBalances = balances.length;
  const affectedRows = insertUpdateMany.data.insert_erc20_snapshot.affected_rows;
  if (nBalances !== affectedRows) {
	  console.log("WARNING: There were", nBalances, "addresses to insert, but", 
      affectedRows, `were affected by the "INSERT_UPDATE_MANY" mutation.`)
  }

  console.log("Done writing INITIAL LOAD to Hasura.", affectedRows, "rows were inserted.")
  return { status: true };
};

const writeIncremental = async (eventData, balances) => {
	// Make sure table is not empty
	const getBatchReq = await hasuraRequest(GET_BATCH, { limit: 1 });
	const getBatch = await getBatchReq.json();
  if (getBatch.errors) {
		return { status: false, message: `ERROR during "GET_BATCH" query: ${JSON.stringify(getBatch.errors)}` };
  }
	if (getBatch.data.erc20_snapshot.length === 0) {
		return { status: false, message: "ERROR: The table must NOT be empty to do INCREMENTAL LOAD. Not writing to Hasura."};
	}
  // We write only the addresses that made transactions between the last scanned block on the previous Hasura write
  // and the block index defined in `toBlock` in the config file. These addresses are already stored in `eventData.newAddresses`
  balances = balances.filter(b => eventData.newAddresses.has(b.address))
  console.log("Addresses to insert/update:")
  console.log(balances);
  const insertUpdateManyReq = await hasuraRequest(INSERT_UPDATE_MANY, { items: balances });
	const insertUpdateMany = await insertUpdateManyReq.json();

  if (insertUpdateMany.errors) {
		return { status: false, message: `ERROR during "INSERT_UPDATE_MANY" mutation: ${JSON.stringify(insertUpdateMany.errors)}` };
  }

  const affectedRows = insertUpdateMany.data.insert_erc20_snapshot.affected_rows;
  if (eventData.newAddresses.size !== affectedRows) {
	  console.log("WARNING: There were", eventData.newAddresses.size, "addresses to insert, but",
      affectedRows, `were affected by the "INSERT_UPDATE_MANY" mutation.`)
  }

  return { status: true };
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
  else {
    console.error("There's been an error while attempting to write to Hasura:")
    console.error(hasuraResult.message);
  }
};