import fetch from "node-fetch";
import { GET_BATCH } from "../graphql/snapshot.js";

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
	console.log({ getBatch });
	if (getBatch.data.erc20_snapshot.length !== 0) {
		console.log("The table must be empty to do initial load. Aborting Hasura write.");
		return;
	}
	// Get number of inserts and assure it's equal to length of balances
	console.log({ balances });
};

const writeIncremental = async (events, balances) => {
	console.log({events, balances});
};

export const hasuraWrite = async (events, balances) => {
	if (events.loadMode.mode === "INITIAL-LOAD") {
		console.log("Writing initial load into Hasura.");
		writeInitial(balances);
	}
	if (events.loadMode.mode === "INCREMENTAL-LOAD") {
		console.log("Writing incremental load into Hasura.");
		writeIncremental(events, balances);
	}
};