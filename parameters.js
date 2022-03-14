import { join } from "path";
import { cwd } from "process";
import { getABI } from "./abi.js";

const parameters = {
	abi: getABI(),
	configFileName: join(cwd(), "snapshot.config.json"),
	configQuestions: [
		{
			type: "input",
			name: "provider",
			message: "Enter the URL of web3 provider",
			default: "http://localhost:8545"
		},
		{
			type: "input",
			name: "contractAddress",
			message: "Enter your contract address"
		},
		{
			type: "input",
			name: "fromBlock",
			message: "Enter the block number to start from",
			default: 0
		},
		{
			type: "input",
			name: "toBlock",
			message: "Enter the block number to end at",
			default: "latest"
		},
		{
			type: "input",
			name: "blocksPerBatch",
			message: "Blocks per batch",
			default: 2500
		},
		{
			type: "input",
			name: "delay",
			message: "Delay per iteration (ms)",
			default: 0
		},
		{
			type: "input",
			name: "format",
			message: "Format -> csv, json, both",
			default: "both"
		},
		{
			type: "input",
			name: "checkIfContract",
			message: "Check addresses if they are contracts or wallets?",
			default: true
		}
	],
	knownTypes: join(cwd(), "/.cache/known-types.json"),
  previousHasuraWrite: join(cwd(), "/.cache/previous-hasura-write.json"),
	outputFileName: join(cwd(), "./balances/{token}"),
	eventsDownloadFolder: join(cwd(), "./tx/{token}/"),
	eventsDownloadFilePath: join(cwd(), "./tx/{token}/{blockNumber}.json")
};

export const getParameters = () => {
	return parameters;
};
