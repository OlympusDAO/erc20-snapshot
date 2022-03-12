import Web3 from "web3";
import { getConfig } from "./config.js";
import { getParameters } from "./parameters.js";

const Config = getConfig();
const Parameters = getParameters();

const web3 = new Web3(new Web3.providers.HttpProvider((Config || {}).provider || "http://localhost:8545"));
const contractAddress = (Config || {}).contractAddress;

export const getContract = () => {
	const contract = new web3.eth.Contract(Parameters.abi, contractAddress);
	return contract;
};
